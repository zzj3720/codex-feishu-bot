import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ConversationItem, RunRecord, ChatSession } from "../domain/types.js";
import { ConversationStore } from "./conversation-store.js";
import { RunStore } from "./run-store.js";
import { SessionStore } from "./session-store.js";

interface LoggerLike {
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

interface RuntimeStateSnapshot {
  version: 1;
  savedAt: string;
  sessions: ChatSession[];
  runs: RunRecord[];
  items: ConversationItem[];
}

interface RuntimeStores {
  sessionStore: SessionStore;
  runStore: RunStore;
  conversationStore: ConversationStore;
}

export interface InterruptedRunNotice {
  chatId: string;
  threadId: string;
  runId: string;
  sourceMessageId: string;
}

export interface RuntimeRestoreResult {
  interruptedRuns: InterruptedRunNotice[];
}

export class RuntimeStatePersister {
  private timer?: NodeJS.Timeout;
  private flushPromise?: Promise<void>;
  private readonly debounceMs: number;
  private stores?: RuntimeStores;

  constructor(
    private readonly filePath: string,
    private readonly logger?: LoggerLike,
    debounceMs = 250
  ) {
    this.debounceMs = debounceMs;
  }

  attach(stores: RuntimeStores): void {
    this.stores = stores;
  }

  scheduleSave(): void {
    if (!this.stores) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flushPromise = this.writeSnapshot().finally(() => {
        this.flushPromise = undefined;
      });
    }, this.debounceMs);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.flushPromise = this.writeSnapshot().finally(() => {
        this.flushPromise = undefined;
      });
    }

    await this.flushPromise;
  }

  async restore(stores: RuntimeStores): Promise<RuntimeRestoreResult> {
    this.stores = stores;

    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        this.logger?.info(
          {
            filePath: this.filePath
          },
          "未找到运行态快照文件，跳过恢复"
        );
        return {
          interruptedRuns: []
        };
      }

      throw error;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<RuntimeStateSnapshot>;
      const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      const runs = Array.isArray(parsed.runs) ? parsed.runs : [];
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const interruptedRuns = runs
        .filter((run): run is RunRecord => Boolean(run && typeof run === "object"))
        .filter((run) => run.status === "running" || run.status === "queued")
        .map((run) => ({
          chatId: run.chatId,
          threadId: run.threadId,
          runId: run.runId,
          sourceMessageId: run.sourceMessageId
        }));

      const sanitizedRuns = runs.map((run) =>
        run.status === "running" || run.status === "queued"
          ? {
              ...run,
              status: "failed" as const,
              errorMessage: run.errorMessage ?? "服务重启后中断，已结束此前未完成任务。"
            }
          : run
      );

      const sanitizedSessions = sessions.map((session) => ({
        ...session,
        activeRunId: undefined,
        activeTurnId: undefined
      }));

      stores.sessionStore.replaceAll(sanitizedSessions);
      stores.runStore.replaceAll(sanitizedRuns);
      stores.conversationStore.replaceAll(items);

      this.logger?.info(
        {
          filePath: this.filePath,
          sessions: sanitizedSessions.length,
          runs: sanitizedRuns.length,
          items: items.length,
          interruptedRuns: interruptedRuns.length
        },
        "已从运行态快照恢复内存状态"
      );

      this.scheduleSave();
      return {
        interruptedRuns
      };
    } catch (error) {
      this.logger?.error(
        {
          filePath: this.filePath,
          error: error instanceof Error ? error.message : String(error)
        },
        "解析运行态快照失败，已跳过恢复"
      );
      return {
        interruptedRuns: []
      };
    }
  }

  private snapshot(): RuntimeStateSnapshot {
    if (!this.stores) {
      throw new Error("runtime stores not attached");
    }

    return {
      version: 1,
      savedAt: new Date().toISOString(),
      sessions: this.stores.sessionStore.list(),
      runs: this.stores.runStore.list(),
      items: this.stores.conversationStore.list()
    };
  }

  private async writeSnapshot(): Promise<void> {
    const snapshot = this.snapshot();
    const dir = dirname(this.filePath);
    const tempFile = `${this.filePath}.tmp`;

    await mkdir(dir, { recursive: true });
    await writeFile(tempFile, JSON.stringify(snapshot), "utf8");
    await rename(tempFile, this.filePath);

    this.logger?.info(
      {
        filePath: this.filePath,
        sessions: snapshot.sessions.length,
        runs: snapshot.runs.length,
        items: snapshot.items.length
      },
      "运行态快照已持久化"
    );
  }
}
