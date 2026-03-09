import assert from "node:assert/strict";
import test from "node:test";

import { ConversationStore } from "../stores/conversation-store.js";
import { RunStore } from "../stores/run-store.js";
import { MessageProjector } from "./message-projector.js";

test("MessageProjector keeps final answer separate from completed tool card", () => {
  const runStore = new RunStore();
  const conversationStore = new ConversationStore();
  const projector = new MessageProjector(runStore, conversationStore);
  const run = runStore.create({
    chatId: "oc_chat_1",
    threadId: "thread_1",
    sourceMessageId: "om_source_1"
  });

  projector.apply(run.runId, {
    kind: "tool_call_started",
    itemId: "tool_1",
    title: "读取文件"
  });
  projector.apply(run.runId, {
    kind: "tool_call_completed",
    itemId: "tool_1",
    status: "completed"
  });
  projector.apply(run.runId, {
    kind: "assistant_message_started",
    itemId: "msg_final",
    source: "final_answer"
  });
  projector.apply(run.runId, {
    kind: "assistant_message_delta",
    itemId: "msg_final",
    text: "最终结果"
  });
  projector.apply(run.runId, {
    kind: "assistant_message_completed",
    itemId: "msg_final",
    text: "最终结果"
  });

  assert.deepEqual(
    projector.list(run.runId).map((item) => [item.itemId, item.kind, item.phase]),
    [
      ["tool_1", "tool_card", "completed"],
      ["msg_final", "assistant_text", "completed"]
    ]
  );
});

test("MessageProjector keeps commentary and final answer as separate assistant items", () => {
  const runStore = new RunStore();
  const conversationStore = new ConversationStore();
  const projector = new MessageProjector(runStore, conversationStore);
  const run = runStore.create({
    chatId: "oc_chat_1",
    threadId: "thread_1",
    sourceMessageId: "om_source_1"
  });

  projector.apply(run.runId, {
    kind: "assistant_message_started",
    itemId: "msg_commentary",
    source: "commentary"
  });
  projector.apply(run.runId, {
    kind: "assistant_message_completed",
    itemId: "msg_commentary",
    text: "这是一条中间过程"
  });
  projector.apply(run.runId, {
    kind: "assistant_message_started",
    itemId: "msg_final",
    source: "final_answer"
  });
  projector.apply(run.runId, {
    kind: "assistant_message_completed",
    itemId: "msg_final",
    text: "这是一条最终结论"
  });

  assert.deepEqual(
    projector.list(run.runId).map((item) => [item.itemId, item.source, item.content]),
    [
      ["msg_commentary", "commentary", "这是一条中间过程"],
      ["msg_final", "final_answer", "这是一条最终结论"]
    ]
  );
});
