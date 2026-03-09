import assert from "node:assert/strict";
import test from "node:test";

import type { CodexEvent, ConversationItem, IncomingChatMessage } from "../domain/types.js";
import type { CodexWorker } from "../integrations/codex/codex-worker.js";
import { ConversationStore } from "../stores/conversation-store.js";
import { RunStore } from "../stores/run-store.js";
import { SessionStore } from "../stores/session-store.js";
import { ChatOrchestrator } from "./chat-orchestrator.js";
import { MessageProjector } from "./message-projector.js";

function createMessage(overrides: Partial<IncomingChatMessage> = {}): IncomingChatMessage {
  return {
    chatId: "oc_group_1",
    chatType: "group",
    messageId: "om_group_1",
    senderId: "ou_user_1",
    senderName: "user-1",
    senderType: "user",
    text: "直接说一句，不带 @",
    mentionsBot: false,
    raw: {},
    ...overrides
  };
}

function createLogger() {
  return {
    info() {
      return undefined;
    },
    warn() {
      return undefined;
    },
    error() {
      return undefined;
    }
  };
}

test("ChatOrchestrator accepts group messages without mentions", async () => {
  const sessionStore = new SessionStore();
  const runStore = new RunStore();
  const conversationStore = new ConversationStore();
  const projector = new MessageProjector(runStore, conversationStore);
  const scheduledItemIds: string[] = [];
  let runTurnCalls = 0;
  let resolveTurn: (() => void) | undefined;
  const turnCompleted = new Promise<void>((resolve) => {
    resolveTurn = resolve;
  });

  const codexWorker: CodexWorker = {
    async ensureThread() {
      return "thread_existing";
    },
    async *runTurn(): AsyncGenerator<CodexEvent> {
      runTurnCalls += 1;
      yield {
        kind: "thread_bound",
        threadId: "thread_accepted_1"
      };
      yield {
        kind: "turn_bound",
        turnId: "turn_accepted_1"
      };
      yield {
        kind: "assistant_message_started",
        itemId: "msg_final_1",
        source: "final_answer"
      };
      yield {
        kind: "assistant_message_completed",
        itemId: "msg_final_1",
        text: "收到"
      };
      resolveTurn?.();
    }
  };

  const orchestrator = new ChatOrchestrator(
    sessionStore,
    runStore,
    conversationStore,
    {
      schedule(item: ConversationItem) {
        scheduledItemIds.push(item.itemId);
      },
      async flushRun() {
        return undefined;
      }
    } as never,
    projector,
    codexWorker,
    "/workspace",
    createLogger()
  );

  orchestrator.enqueue(createMessage());

  await turnCompleted;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(runTurnCalls, 1);
  assert.equal(runStore.list().length, 1);
  assert.deepEqual(scheduledItemIds, ["msg_final_1", "msg_final_1"]);
  assert.equal(conversationStore.list().length, 1);
  assert.equal(conversationStore.list()[0]?.content, "收到");
});

test("ChatOrchestrator steers into the active turn instead of creating a new queued run", async () => {
  const sessionStore = new SessionStore();
  const runStore = new RunStore();
  const conversationStore = new ConversationStore();
  const projector = new MessageProjector(runStore, conversationStore);
  const existingRun = runStore.create({
    chatId: "oc_group_1",
    threadId: "thread_active_1",
    sourceMessageId: "om_original_1"
  });
  sessionStore.save({
    chatId: "oc_group_1",
    threadId: "thread_active_1",
    workspaceId: "/workspace",
    activeRunId: existingRun.runId,
    activeTurnId: "turn_active_1",
    updatedAt: new Date().toISOString()
  });

  let steerCalls = 0;
  let runTurnCalls = 0;
  let resolveSteer: (() => void) | undefined;
  const steerCompleted = new Promise<void>((resolve) => {
    resolveSteer = resolve;
  });

  const codexWorker: CodexWorker = {
    async ensureThread() {
      return "thread_active_1";
    },
    async steerTurn(context) {
      steerCalls += 1;
      assert.equal(context.threadId, "thread_active_1");
      assert.equal(context.turnId, "turn_active_1");
      assert.equal(context.message.messageId, "om_group_steer_1");
      resolveSteer?.();
    },
    async *runTurn(): AsyncGenerator<CodexEvent> {
      runTurnCalls += 1;
    }
  };

  const orchestrator = new ChatOrchestrator(
    sessionStore,
    runStore,
    conversationStore,
    {
      schedule() {
        return undefined;
      },
      async flushRun() {
        return undefined;
      }
    } as never,
    projector,
    codexWorker,
    "/workspace",
    createLogger()
  );

  orchestrator.enqueue(
    createMessage({
      messageId: "om_group_steer_1",
      text: "这条应该直接补充给正在运行的 turn"
    })
  );

  await steerCompleted;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(steerCalls, 1);
  assert.equal(runTurnCalls, 0);
  assert.equal(runStore.list().length, 1);
  assert.equal(runStore.list()[0]?.sourceMessageId, "om_group_steer_1");
});

test("ChatOrchestrator ignores app-sent group messages to avoid loops", async () => {
  const sessionStore = new SessionStore();
  const runStore = new RunStore();
  const conversationStore = new ConversationStore();
  const projector = new MessageProjector(runStore, conversationStore);
  let runTurnCalls = 0;

  const codexWorker: CodexWorker = {
    async ensureThread() {
      return "thread_existing";
    },
    async *runTurn(): AsyncGenerator<CodexEvent> {
      runTurnCalls += 1;
      yield {
        kind: "run_status",
        status: "completed"
      };
    }
  };

  const orchestrator = new ChatOrchestrator(
    sessionStore,
    runStore,
    conversationStore,
    {
      schedule() {
        return undefined;
      },
      async flushRun() {
        return undefined;
      }
    } as never,
    projector,
    codexWorker,
    "/workspace",
    createLogger()
  );

  orchestrator.enqueue(
    createMessage({
      messageId: "om_bot_1",
      senderId: "cli_bot_1",
      senderName: "codex",
      senderType: "app",
      text: "机器人自己发的话"
    })
  );

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(runTurnCalls, 0);
  assert.equal(runStore.list().length, 0);
  assert.equal(conversationStore.list().length, 0);
});

test("ChatOrchestrator ignores duplicated incoming message ids", async () => {
  const sessionStore = new SessionStore();
  const runStore = new RunStore();
  const conversationStore = new ConversationStore();
  const projector = new MessageProjector(runStore, conversationStore);
  let runTurnCalls = 0;
  let resolveTurn: (() => void) | undefined;
  const turnCompleted = new Promise<void>((resolve) => {
    resolveTurn = resolve;
  });

  const codexWorker: CodexWorker = {
    async ensureThread() {
      return "thread_existing";
    },
    async *runTurn(): AsyncGenerator<CodexEvent> {
      runTurnCalls += 1;
      yield {
        kind: "thread_bound",
        threadId: "thread_existing"
      };
      yield {
        kind: "turn_bound",
        turnId: "turn_existing"
      };
      yield {
        kind: "assistant_message_started",
        itemId: "msg_final_duplicate",
        source: "final_answer"
      };
      yield {
        kind: "assistant_message_completed",
        itemId: "msg_final_duplicate",
        text: "只发一次"
      };
      resolveTurn?.();
    }
  };

  const orchestrator = new ChatOrchestrator(
    sessionStore,
    runStore,
    conversationStore,
    {
      schedule() {
        return undefined;
      },
      async flushRun() {
        return undefined;
      }
    } as never,
    projector,
    codexWorker,
    "/workspace",
    createLogger()
  );

  const message = createMessage({
    messageId: "om_duplicate_1",
    text: "同一条飞书消息被重复投递"
  });

  orchestrator.enqueue(message);
  orchestrator.enqueue(message);

  await turnCompleted;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(runTurnCalls, 1);
  assert.equal(runStore.list().length, 1);
  assert.equal(conversationStore.list().length, 1);
});
