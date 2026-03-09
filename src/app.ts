import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

import type { Env } from "./config/env.js";
import { CodexAppServerWorker } from "./integrations/codex/app-server-worker.js";
import type { CodexWorker } from "./integrations/codex/codex-worker.js";
import { MockCodexWorker } from "./integrations/codex/mock-codex-worker.js";
import { FakeFeishuMessageClient } from "./integrations/feishu/fake-feishu-message-client.js";
import { FakeFeishuWsSubscriber } from "./integrations/feishu/fake-feishu-ws-subscriber.js";
import {
  createFeishuOpenApiClient,
  hasFeishuCredentials
} from "./integrations/feishu/feishu-openapi-client.js";
import { ConsoleFeishuMessageClient } from "./integrations/feishu/feishu-message-client.js";
import type { FeishuMessageClient } from "./integrations/feishu/feishu-message-client.js";
import { FeishuSdkMessageClient } from "./integrations/feishu/feishu-sdk-message-client.js";
import { FeishuWsSubscriber } from "./integrations/feishu/feishu-ws-subscriber.js";
import { registerDebugRoutes } from "./routes/debug.js";
import { registerFeishuRoutes } from "./routes/feishu.js";
import { registerHealthRoutes } from "./routes/health.js";
import { ChatOrchestrator } from "./services/chat-orchestrator.js";
import { ConversationDeliveryService } from "./services/conversation-delivery-service.js";
import { MessageProjector } from "./services/message-projector.js";
import { ConversationStore } from "./stores/conversation-store.js";
import { RunStore } from "./stores/run-store.js";
import { RuntimeStatePersister } from "./stores/runtime-state-persister.js";
import { SessionStore } from "./stores/session-store.js";

interface LoggerLike {
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

function buildCodexWorker(env: Env, logger: LoggerLike): CodexWorker {
  if (env.CODEX_MODE === "app-server") {
    return new CodexAppServerWorker(env, logger);
  }

  return new MockCodexWorker();
}

function buildFeishuMessageClient(env: Env, logger: LoggerLike): FeishuMessageClient {
  if (env.FEISHU_PROVIDER === "fake") {
    return new FakeFeishuMessageClient(env.FAKE_FEISHU_BASE_URL);
  }

  if (!hasFeishuCredentials(env)) {
    return new ConsoleFeishuMessageClient();
  }

  return new FeishuSdkMessageClient(createFeishuOpenApiClient(env), logger);
}

export interface AppRuntime {
  app: FastifyInstance;
  startExternalServices(): Promise<void>;
  stopExternalServices(): Promise<void>;
}

export function buildAppRuntime(env: Env): AppRuntime {
  const app = Fastify({
    logger: true
  });

  const runtimeStatePersister = new RuntimeStatePersister(
    env.RUNTIME_STATE_FILE,
    app.log
  );
  let sessionStore: SessionStore;
  let runStore: RunStore;
  let conversationStore: ConversationStore;
  const persistRuntimeState = () => runtimeStatePersister.scheduleSave();

  sessionStore = new SessionStore(persistRuntimeState);
  runStore = new RunStore(persistRuntimeState);
  conversationStore = new ConversationStore(persistRuntimeState);
  runtimeStatePersister.attach({
    sessionStore,
    runStore,
    conversationStore
  });
  const feishuClient = buildFeishuMessageClient(env, app.log);
  const deliveryService = new ConversationDeliveryService(
    feishuClient,
    conversationStore,
    env.LIVE_UPDATE_DEBOUNCE_MS,
    app.log
  );
  const projector = new MessageProjector(runStore, conversationStore);
  const codexWorker = buildCodexWorker(env, app.log);
  const orchestrator = new ChatOrchestrator(
    sessionStore,
    runStore,
    conversationStore,
    deliveryService,
    projector,
    codexWorker,
    env.DEFAULT_WORKSPACE,
    app.log
  );

  void registerHealthRoutes(app);
  void registerDebugRoutes(app, {
    orchestrator
  });
  void registerFeishuRoutes(app, {
    orchestrator
  });

  const wsSubscriber =
    env.FEISHU_TRANSPORT !== "websocket"
      ? undefined
      : env.FEISHU_PROVIDER === "fake"
        ? new FakeFeishuWsSubscriber({
            env,
            logger: app.log,
            onMessage: (message) => {
              orchestrator.enqueue(message);
            }
          })
        : hasFeishuCredentials(env)
          ? new FeishuWsSubscriber({
              env,
              logger: app.log,
              onMessage: (message) => {
                orchestrator.enqueue(message);
              }
            })
          : undefined;

  return {
    app,
    async startExternalServices() {
      await mkdir(env.CODEX_ARTIFACTS_DIR, {
        recursive: true
      });
      await mkdir(dirname(env.RUNTIME_STATE_FILE), {
        recursive: true
      });
      const restored = await runtimeStatePersister.restore({
        sessionStore,
        runStore,
        conversationStore
      });
      await runtimeStatePersister.flush();

      app.log.info(
        {
          host: env.HOST,
          port: env.PORT,
          codexMode: env.CODEX_MODE,
          codexManaged: env.CODEX_APP_SERVER_MANAGED,
          codexListenUrl: env.CODEX_APP_SERVER_LISTEN_URL,
          codexModel: env.CODEX_APP_SERVER_MODEL,
          feishuProvider: env.FEISHU_PROVIDER,
          feishuTransport: env.FEISHU_TRANSPORT,
          feishuDomain: env.FEISHU_DOMAIN,
          hasFeishuCredentials: hasFeishuCredentials(env),
          defaultWorkspace: env.DEFAULT_WORKSPACE,
          codexArtifactsDir: env.CODEX_ARTIFACTS_DIR,
          runtimeStateFile: env.RUNTIME_STATE_FILE
        },
        "应用启动配置摘要"
      );
      await codexWorker.start?.();

      if (restored.interruptedRuns.length > 0) {
        const interruptedByChat = new Map<string, number>();
        for (const run of restored.interruptedRuns) {
          interruptedByChat.set(run.chatId, (interruptedByChat.get(run.chatId) ?? 0) + 1);
        }

        for (const [chatId, count] of interruptedByChat) {
          const content =
            count > 1
              ? `服务器刚刚重启，这个群里有 ${count} 个进行中的任务被中断了。要继续的话，直接回复“继续”，也可以顺手补一句要我接着做什么。`
              : "服务器刚刚重启，之前这个群里的任务被中断了。要继续的话，直接回复“继续”，也可以顺手补一句要我接着做什么。";

          try {
            await feishuClient.sendText({
              chatId,
              content
            });
            app.log.info(
              {
                chatId,
                interruptedRuns: count
              },
              "已向受影响群发送重启中断提示"
            );
          } catch (error) {
            app.log.error(
              {
                chatId,
                interruptedRuns: count,
                error: error instanceof Error ? error.message : String(error)
              },
              "向受影响群发送重启中断提示失败"
            );
          }
        }
      }

      if (env.FEISHU_TRANSPORT !== "websocket") {
        app.log.info("飞书事件入口未使用 WebSocket 模式");
        return;
      }

      if (env.FEISHU_PROVIDER !== "fake" && !hasFeishuCredentials(env)) {
        app.log.warn("缺少飞书凭证，跳过 WebSocket 建连");
        return;
      }

      await wsSubscriber?.start();
    },
    async stopExternalServices() {
      await wsSubscriber?.close();
      await codexWorker.close?.();
      await runtimeStatePersister.flush();
    }
  };
}
