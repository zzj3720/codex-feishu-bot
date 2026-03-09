import assert from "node:assert/strict";
import test from "node:test";

import type { ConversationItem } from "../domain/types.js";
import { ConversationStore } from "../stores/conversation-store.js";
import { ConversationDeliveryService } from "./conversation-delivery-service.js";

function createItem(overrides: Partial<ConversationItem> = {}): ConversationItem {
  const now = "2026-03-09T00:00:00.000Z";
  return {
    runId: "run_1",
    chatId: "oc_chat_1",
    sourceMessageId: "om_source_1",
    itemId: "msg_1",
    order: 1,
    kind: "assistant_text",
    source: "commentary",
    phase: "streaming",
    content: "处理中",
    details: [],
    filePaths: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

test("ConversationDeliveryService sends then updates the same assistant text item as one card", async () => {
  const calls: string[] = [];
  const conversationStore = new ConversationStore();
  const service = new ConversationDeliveryService(
    {
      sendText: async () => {
        calls.push("sendText");
        return "om_text_1";
      },
      updateText: async () => {
        calls.push("updateText");
      },
      sendCard: async () => {
        calls.push("sendCard");
        return "om_card_1";
      },
      updateCard: async () => {
        calls.push("updateCard");
      },
      sendFile: async () => {
        calls.push("sendFile");
        return "om_file_1";
      }
    },
    conversationStore,
    1,
    console
  );

  conversationStore.save(createItem());
  await service.flush("run_1", "msg_1");

  conversationStore.update("run_1", "msg_1", {
    content: "处理中..."
  });
  await service.flush("run_1", "msg_1");

  assert.deepEqual(calls, ["sendCard", "updateCard"]);
});

test("ConversationDeliveryService sends a placeholder card for final answer before text arrives", async () => {
  const calls: string[] = [];
  const conversationStore = new ConversationStore();
  const service = new ConversationDeliveryService(
    {
      sendText: async () => "om_text_1",
      updateText: async () => {
        return undefined;
      },
      sendCard: async () => {
        calls.push("sendCard");
        return "om_card_1";
      },
      updateCard: async () => {
        calls.push("updateCard");
      },
      sendFile: async () => "om_file_1"
    },
    conversationStore,
    1200,
    console
  );

  conversationStore.save(
    createItem({
      source: "final_answer",
      phase: "queued",
      content: undefined
    })
  );

  await service.flush("run_1", "msg_1");

  assert.deepEqual(calls, ["sendCard"]);
  assert.equal(conversationStore.get("run_1", "msg_1")?.feishuMessageId, "om_card_1");

  conversationStore.update("run_1", "msg_1", {
    phase: "streaming",
    content: "第一段结果"
  });
  await service.flush("run_1", "msg_1");

  assert.deepEqual(calls, ["sendCard", "updateCard"]);
});

test("ConversationDeliveryService does not send placeholder cards for empty commentary", async () => {
  const calls: string[] = [];
  const conversationStore = new ConversationStore();
  const service = new ConversationDeliveryService(
    {
      sendText: async () => "om_text_1",
      updateText: async () => {
        return undefined;
      },
      sendCard: async () => {
        calls.push("sendCard");
        return "om_card_1";
      },
      updateCard: async () => {
        calls.push("updateCard");
      },
      sendFile: async () => "om_file_1"
    },
    conversationStore,
    1200,
    console
  );

  conversationStore.save(
    createItem({
      source: "commentary",
      phase: "queued",
      content: undefined
    })
  );

  await service.flush("run_1", "msg_1");

  assert.deepEqual(calls, []);
});

test("ConversationDeliveryService serializes concurrent flushes for the same item", async () => {
  const calls: string[] = [];
  const conversationStore = new ConversationStore();
  let releaseSend: (() => void) | undefined;
  const sendStarted = new Promise<void>((resolve) => {
    releaseSend = resolve;
  });

  const service = new ConversationDeliveryService(
    {
      sendText: async () => "om_text_1",
      updateText: async () => {
        return undefined;
      },
      sendCard: async () => {
        calls.push("sendCard");
        await sendStarted;
        return "om_card_1";
      },
      updateCard: async () => {
        calls.push("updateCard");
      },
      sendFile: async () => "om_file_1"
    },
    conversationStore,
    1,
    console
  );

  conversationStore.save(createItem());

  const firstFlush = service.flush("run_1", "msg_1");
  const secondFlush = service.flush("run_1", "msg_1");

  await new Promise((resolve) => setTimeout(resolve, 10));
  releaseSend?.();

  await Promise.all([firstFlush, secondFlush]);

  assert.deepEqual(calls, ["sendCard"]);
});

test("ConversationDeliveryService uses a short debounce window for streaming assistant text", async () => {
  const conversationStore = new ConversationStore();
  const service = new ConversationDeliveryService(
    {
      sendText: async () => "om_text_1",
      updateText: async () => {
        return undefined;
      },
      sendCard: async () => "om_card_1",
      updateCard: async () => {
        return undefined;
      },
      sendFile: async () => "om_file_1"
    },
    conversationStore,
    1200,
    console
  );

  const recordedTimeouts: number[] = [];
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;

  globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0], timeout?: number, ...args: unknown[]) => {
    recordedTimeouts.push(Number(timeout));
    return originalSetTimeout(handler, 0, ...args);
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((timeoutId: Parameters<typeof clearTimeout>[0]) => {
    return originalClearTimeout(timeoutId);
  }) as typeof clearTimeout;

  try {
    service.schedule(
      createItem({
        source: "final_answer",
        phase: "streaming"
      })
    );

    service.schedule(
      createItem({
        itemId: "tool_1",
        kind: "tool_card",
        source: "tool",
        phase: "streaming",
        title: "执行命令"
      })
    );

    await new Promise((resolve) => originalSetTimeout(resolve, 10));
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }

  assert.deepEqual(recordedTimeouts.slice(0, 2), [200, 1200]);
});
