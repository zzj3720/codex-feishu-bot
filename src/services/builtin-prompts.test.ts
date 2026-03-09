import assert from "node:assert/strict";
import test from "node:test";

import type { IncomingChatMessage } from "../domain/types.js";
import { resolveBuiltinPromptMessage } from "./builtin-prompts.js";

function createMessage(text: string): IncomingChatMessage {
  return {
    chatId: "oc_group_builtin",
    chatType: "group",
    messageId: "om_builtin_1",
    senderId: "ou_user_builtin",
    senderName: "user-builtin",
    senderType: "user",
    text,
    mentionsBot: false,
    raw: {}
  };
}

test("resolveBuiltinPromptMessage leaves normal messages untouched", () => {
  const message = createMessage("帮我看看当前 Docker 配置");
  const result = resolveBuiltinPromptMessage(message);

  assert.equal(result.shortcut, undefined);
  assert.equal(result.message, message);
});

test("resolveBuiltinPromptMessage expands the one-click create bot shortcut", () => {
  const result = resolveBuiltinPromptMessage(createMessage("一键创建飞书机器人"));

  assert.equal(result.shortcut, "create_feishu_bot");
  assert.match(result.message.text, /npx -y lark-op-cli@latest create-bot/);
  assert.match(result.message.text, /ASCII 二维码/);
  assert.match(result.message.text, /不要修改仓库源码/);
});
