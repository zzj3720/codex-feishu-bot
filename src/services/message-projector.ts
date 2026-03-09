import { basename } from "node:path";

import type { CodexEvent, ConversationItem, RunRecord } from "../domain/types.js";
import { ConversationStore } from "../stores/conversation-store.js";
import { RunStore } from "../stores/run-store.js";

interface ProjectionResult {
  run: RunRecord;
  items: ConversationItem[];
}

function appendUnique(items: string[], value: string, limit: number): string[] {
  const next = items.filter((item) => item !== value);
  next.push(value);
  return next.slice(-limit);
}

const MAX_DETAILS = 12;
const MAX_FILES = 12;

export class MessageProjector {
  constructor(
    private readonly runStore: RunStore,
    private readonly conversationStore: ConversationStore
  ) {}

  apply(runId: string, event: CodexEvent): ProjectionResult {
    const run = this.runStore.get(runId);
    if (!run) {
      throw new Error(`run not found: ${runId}`);
    }

    switch (event.kind) {
      case "thread_bound":
        return {
          run: this.runStore.update(runId, {
            threadId: event.threadId
          }) ?? run,
          items: []
        };
      case "turn_bound":
        return {
          run,
          items: []
        };
      case "run_status":
        return {
          run:
            this.runStore.setStatus(
              runId,
              event.status,
              event.status === "failed" ? event.detail : undefined
            ) ?? run,
          items: []
        };
      case "assistant_message_started": {
        const item = this.ensureItem(run, event.itemId, "assistant_text", event.source, {
          phase: "queued"
        });
        return {
          run: event.source === "final_answer"
            ? this.runStore.setStatus(runId, "running") ?? run
            : run,
          items: [item]
        };
      }
      case "assistant_message_delta": {
        const current =
          this.conversationStore.get(runId, event.itemId) ??
          this.ensureItem(run, event.itemId, "assistant_text", "commentary");
        const item = this.conversationStore.update(runId, event.itemId, {
          phase: "streaming",
          content: `${current.content ?? ""}${event.text}`
        }) ?? current;
        return {
          run: this.runStore.setStatus(runId, "running") ?? run,
          items: [item]
        };
      }
      case "assistant_message_completed": {
        const current =
          this.conversationStore.get(runId, event.itemId) ??
          this.ensureItem(run, event.itemId, "assistant_text", "final_answer");
        const item = this.conversationStore.update(runId, event.itemId, {
          phase: "completed",
          content: event.text
        }) ?? current;
        return {
          run: item.source === "final_answer"
            ? this.runStore.setStatus(runId, "completed") ?? run
            : this.runStore.setStatus(runId, "running") ?? run,
          items: [item]
        };
      }
      case "tool_call_started": {
        const item = this.ensureItem(run, event.itemId, "tool_card", "tool", {
          phase: "streaming",
          title: event.title,
          command: event.command,
          details: event.command ? [`执行: ${event.command}`] : []
        });
        return {
          run: this.runStore.setStatus(runId, "running") ?? run,
          items: [item]
        };
      }
      case "tool_call_delta": {
        const current =
          this.conversationStore.get(runId, event.itemId) ??
          this.ensureItem(run, event.itemId, "tool_card", "tool", {
            phase: "streaming",
            title: "工具调用"
          });
        const item = this.conversationStore.update(runId, event.itemId, {
          phase: "streaming",
          output: event.output ?? current.output,
          details: event.detail
            ? appendUnique(current.details, event.detail, MAX_DETAILS)
            : current.details,
          filePaths: event.path
            ? appendUnique(current.filePaths, event.path, MAX_FILES)
            : current.filePaths
        }) ?? current;
        return {
          run: this.runStore.setStatus(runId, "running") ?? run,
          items: [item]
        };
      }
      case "tool_call_completed": {
        const current =
          this.conversationStore.get(runId, event.itemId) ??
          this.ensureItem(run, event.itemId, "tool_card", "tool");
        let filePaths = current.filePaths;
        for (const path of event.paths ?? []) {
          filePaths = appendUnique(filePaths, path, MAX_FILES);
        }
        const item = this.conversationStore.update(runId, event.itemId, {
          phase: event.status === "failed" ? "failed" : "completed",
          title: event.title ?? current.title,
          output: event.output ?? current.output,
          filePaths
        }) ?? current;
        return {
          run: this.runStore.setStatus(runId, "running") ?? run,
          items: [item]
        };
      }
      case "artifact_ready": {
        const item = this.ensureItem(run, event.itemId, "artifact_file", "artifact", {
          phase: "completed",
          title: event.title ?? basename(event.path),
          artifactPath: event.path
        });
        return {
          run: this.runStore.setStatus(runId, "running") ?? run,
          items: [item]
        };
      }
      case "error": {
        const errorItemId = `error:${runId}`;
        const item =
          this.conversationStore.get(runId, errorItemId) ??
          this.ensureItem(run, errorItemId, "assistant_text", "final_answer", {
            phase: "failed",
            content: event.message
          });
        const failedItem = this.conversationStore.update(runId, errorItemId, {
          phase: "failed",
          content: event.message
        }) ?? item;
        return {
          run: this.runStore.setStatus(runId, "failed", event.message) ?? run,
          items: [failedItem]
        };
      }
    }
  }

  list(runId: string): ConversationItem[] {
    return this.conversationStore.listByRun(runId);
  }

  private ensureItem(
    run: RunRecord,
    itemId: string,
    kind: ConversationItem["kind"],
    source: ConversationItem["source"],
    patch: Partial<ConversationItem> = {}
  ): ConversationItem {
    const existing = this.conversationStore.get(run.runId, itemId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const item: ConversationItem = {
      runId: run.runId,
      chatId: run.chatId,
      sourceMessageId: run.sourceMessageId,
      itemId,
      order: this.conversationStore.listByRun(run.runId).length + 1,
      kind,
      source,
      phase: "queued",
      details: [],
      filePaths: [],
      createdAt: now,
      updatedAt: now,
      ...patch
    };

    this.conversationStore.save(item);
    return item;
  }
}
