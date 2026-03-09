import assert from "node:assert/strict";
import test from "node:test";

import { parseFeishuMessageEventResult } from "./parse-feishu-message.js";

test("parseFeishuMessageEventResult supports flattened long-connection payload", () => {
  const payload = {
    event_id: "evt_1",
    event_type: "im.message.receive_v1",
    tenant_key: "tenant_1",
    sender: {
      sender_id: {
        open_id: "ou_sender_1"
      },
      sender_type: "user"
    },
    message: {
      message_id: "om_1",
      chat_id: "oc_1",
      chat_type: "p2p",
      content: "{\"text\":\"hello from feishu\"}"
    }
  };

  const result = parseFeishuMessageEventResult(payload);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(
    {
      chatId: result.message.chatId,
      chatType: result.message.chatType,
      messageId: result.message.messageId,
      senderId: result.message.senderId,
      senderType: result.message.senderType,
      tenantKey: result.message.tenantKey,
      text: result.message.text,
      mentionsBot: result.message.mentionsBot
    },
    {
      chatId: "oc_1",
      chatType: "p2p",
      messageId: "om_1",
      senderId: "ou_sender_1",
      senderType: "user",
      tenantKey: "tenant_1",
      text: "hello from feishu",
      mentionsBot: false
    }
  );
});

test("parseFeishuMessageEventResult supports real flattened payload without sender", () => {
  const payload = {
    schema: "2.0",
    event_id: "evt_real_1",
    token: "token",
    create_time: "1772995703788",
    event_type: "im.message.receive_v1",
    tenant_key: "tenant_real",
    app_id: "cli_real",
    message: {
      message_id: "om_real_1",
      chat_id: "oc_real_1",
      chat_type: "group",
      message_type: "text",
      content: "{\"text\":\"@codex 你好\"}",
      mentions: [
        {
          key: "@_user_1",
          name: "codex"
        }
      ]
    }
  };

  const result = parseFeishuMessageEventResult(payload);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.message.chatId, "oc_real_1");
  assert.equal(result.message.messageId, "om_real_1");
  assert.equal(result.message.chatType, "group");
  assert.equal(result.message.senderId, "unknown");
  assert.equal(result.message.senderType, "unknown");
  assert.equal(result.message.text, "@codex 你好");
  assert.equal(result.message.mentionsBot, true);
});

test("parseFeishuMessageEventResult supports webhook envelope payload", () => {
  const payload = {
    schema: "2.0",
    header: {
      event_type: "im.message.receive_v1",
      tenant_key: "tenant_2"
    },
    event: {
      sender: {
        sender_id: {
          open_id: "ou_sender_2"
        }
      },
      message: {
        message_id: "om_2",
        chat_id: "oc_2",
        chat_type: "group",
        content: "{\"text\":\"@codex 帮我看一下\"}",
        mentions: [
          {
            key: "@_user_1",
            name: "codex"
          }
        ]
      }
    }
  };

  const result = parseFeishuMessageEventResult(payload);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.message.chatId, "oc_2");
  assert.equal(result.message.chatType, "group");
  assert.equal(result.message.messageId, "om_2");
  assert.equal(result.message.senderId, "ou_sender_2");
  assert.equal(result.message.senderType, "unknown");
  assert.equal(result.message.tenantKey, "tenant_2");
  assert.equal(result.message.text, "@codex 帮我看一下");
  assert.equal(result.message.mentionsBot, true);
});

test("parseFeishuMessageEventResult extracts bot sender type for loop prevention", () => {
  const payload = {
    event_type: "im.message.receive_v1",
    sender: {
      sender_id: {
        open_id: "cli_bot"
      },
      sender_type: "app"
    },
    message: {
      message_id: "om_bot_1",
      chat_id: "oc_bot_1",
      chat_type: "group",
      content: "{\"text\":\"机器人自己发的话\"}"
    }
  };

  const result = parseFeishuMessageEventResult(payload);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.message.senderType, "app");
});

test("parseFeishuMessageEventResult returns structured failure on invalid payload", () => {
  const result = parseFeishuMessageEventResult({
    foo: "bar"
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.failure.reason, /消息字段/);
  assert.match(result.failure.shape ?? "", /rootKeys/);
});
