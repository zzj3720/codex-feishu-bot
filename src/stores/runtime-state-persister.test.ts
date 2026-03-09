import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { ConversationStore } from "./conversation-store.js";
import { RunStore } from "./run-store.js";
import { RuntimeStatePersister } from "./runtime-state-persister.js";
import { SessionStore } from "./session-store.js";

test("RuntimeStatePersister restores sessions and clears stale active run state", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "codex-feishu-state-"));
  const filePath = join(tempDir, "runtime-state.json");

  const persister = new RuntimeStatePersister(filePath);
  const persist = () => persister.scheduleSave();
  const sessionStore = new SessionStore(persist);
  const runStore = new RunStore(persist);
  const conversationStore = new ConversationStore(persist);

  persister.attach({
    sessionStore,
    runStore,
    conversationStore
  });

  sessionStore.save({
    chatId: "oc_chat_1",
    threadId: "thread_1",
    workspaceId: "/workspace",
    activeRunId: "run_1",
    activeTurnId: "turn_1",
    updatedAt: "2026-03-09T00:00:00.000Z"
  });
  runStore.save({
    runId: "run_1",
    chatId: "oc_chat_1",
    threadId: "thread_1",
    sourceMessageId: "om_1",
    status: "running",
    startedAt: "2026-03-09T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z"
  });
  conversationStore.save({
    runId: "run_1",
    chatId: "oc_chat_1",
    sourceMessageId: "om_1",
    itemId: "msg_1",
    order: 1,
    kind: "assistant_text",
    source: "commentary",
    phase: "completed",
    content: "hello",
    details: [],
    filePaths: [],
    createdAt: "2026-03-09T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z"
  });

  await persister.flush();

  const restoredSessionStore = new SessionStore();
  const restoredRunStore = new RunStore();
  const restoredConversationStore = new ConversationStore();
  const restoredPersister = new RuntimeStatePersister(filePath);

  const restored = await restoredPersister.restore({
    sessionStore: restoredSessionStore,
    runStore: restoredRunStore,
    conversationStore: restoredConversationStore
  });

  assert.deepEqual(restored.interruptedRuns, [
    {
      chatId: "oc_chat_1",
      threadId: "thread_1",
      runId: "run_1",
      sourceMessageId: "om_1"
    }
  ]);

  const restoredSession = restoredSessionStore.get("oc_chat_1");
  assert.ok(restoredSession);
  assert.equal(restoredSession.threadId, "thread_1");
  assert.equal(restoredSession.activeRunId, undefined);
  assert.equal(restoredSession.activeTurnId, undefined);

  const restoredRun = restoredRunStore.get("run_1");
  assert.ok(restoredRun);
  assert.equal(restoredRun.status, "failed");
  assert.match(restoredRun.errorMessage ?? "", /服务重启后中断/);

  const restoredItem = restoredConversationStore.get("run_1", "msg_1");
  assert.ok(restoredItem);
  assert.equal(restoredItem.content, "hello");

  await restoredPersister.flush();
  const raw = await readFile(filePath, "utf8");
  assert.match(raw, /"threadId":"thread_1"/);
  assert.match(raw, /"status":"failed"/);
});
