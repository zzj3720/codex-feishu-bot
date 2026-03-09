import assert from "node:assert/strict";
import test from "node:test";

import type { ConversationItem } from "../../domain/types.js";
import {
  renderAssistantCardContent,
  renderToolCardContent
} from "./feishu-card-renderer.js";

function createItem(overrides: Partial<ConversationItem> = {}): ConversationItem {
  const now = "2026-03-09T00:00:00.000Z";
  return {
    runId: "run_1",
    chatId: "oc_chat_1",
    sourceMessageId: "om_source_1",
    itemId: "item_1",
    order: 1,
    kind: "assistant_text",
    source: "commentary",
    phase: "completed",
    content: "先读取配置，再执行命令。",
    details: [],
    filePaths: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

test("renderAssistantCardContent marks commentary as non-final", () => {
  const payload = JSON.parse(renderAssistantCardContent(createItem()));

  assert.equal(payload.schema, "2.0");
  assert.equal(payload.body.elements[0].tag, "collapsible_panel");
  assert.equal(payload.body.elements[0].expanded, false);
  assert.equal(payload.body.elements[0].elements[0].tag, "markdown");
  assert.equal(payload.body.elements[0].elements[0].content, "先读取配置，再执行命令。");
  assert.equal(payload.header, undefined);
});

test("renderAssistantCardContent marks final answer separately", () => {
  const payload = JSON.parse(
    renderAssistantCardContent(
      createItem({
        itemId: "item_final",
        source: "final_answer",
        content: "最终只需要同步这一条结论。"
      })
    )
  );

  assert.equal(payload.schema, "2.0");
  assert.equal(payload.header, undefined);
  assert.equal(payload.body.elements[0].tag, "markdown");
  assert.equal(payload.body.elements[0].content, "最终只需要同步这一条结论。");
});

test("renderAssistantCardContent strips duplicated process paragraph from final answer", () => {
  const payload = JSON.parse(
    renderAssistantCardContent(
      createItem({
        itemId: "item_final_process",
        source: "final_answer",
        content: "- 中间过程：我先读了 package.json。\n\n- `build`: `tsc -p tsconfig.json`\n- `test`: `tsx --test`"
      })
    )
  );

  assert.equal(
    payload.body.elements[0].content,
    "- `build`: `tsc -p tsconfig.json`\n- `test`: `tsx --test`"
  );
});

test("renderToolCardContent emits markdown blocks for tool progress", () => {
  const payload = JSON.parse(
    renderToolCardContent(
      createItem({
        itemId: "tool_1",
        kind: "tool_card",
        source: "tool",
        title: "执行命令",
        command: "pnpm test",
        output: "all tests passed",
        details: ["启动测试", "收集输出"],
        filePaths: ["src/app.ts"]
      })
    )
  );

  assert.equal(payload.schema, "2.0");
  assert.equal(payload.header, undefined);
  assert.equal(payload.body.elements[0].tag, "collapsible_panel");
  assert.equal(payload.body.elements[0].expanded, false);
  assert.equal(payload.body.elements[0].header.title.tag, "markdown");
  assert.match(payload.body.elements[0].header.title.content, /\*\*已完成 · pnpm test\*\*/);
  assert.match(payload.body.elements[0].elements[0].content, /\*\*已完成\*\*/);
  assert.match(payload.body.elements[0].elements[0].content, /- 启动测试/);
  assert.match(payload.body.elements[0].elements[0].content, /```bash/);
  assert.match(payload.body.elements[0].elements[0].content, /\*\*输出\*\*/);
});

test("renderToolCardContent uses specific search query as folded title", () => {
  const payload = JSON.parse(
    renderToolCardContent(
      createItem({
        itemId: "tool_search_1",
        kind: "tool_card",
        source: "tool",
        title: "Escape from Tarkov latest patch notes 2026 official",
        details: ["完成搜索: Escape from Tarkov latest patch notes 2026 official"]
      })
    )
  );

  assert.match(
    payload.body.elements[0].header.title.content,
    /\*\*已完成 · Escape from Tarkov latest patch notes 2026 official\*\*/
  );
});
