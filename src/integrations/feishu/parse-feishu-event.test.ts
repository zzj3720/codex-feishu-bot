import assert from "node:assert/strict";
import test from "node:test";

import { parseFeishuWebhook } from "./parse-feishu-event.js";

test("parseFeishuWebhook supports challenge payload", () => {
  const result = parseFeishuWebhook({
    challenge: "challenge-token"
  });

  assert.deepEqual(result, {
    kind: "challenge",
    challenge: "challenge-token"
  });
});

test("parseFeishuWebhook supports schema 2.0 message payload", () => {
  const result = parseFeishuWebhook({
    schema: "2.0",
    header: {
      event_type: "im.message.receive_v1"
    },
    event: {
      sender: {
        sender_id: {
          open_id: "ou_test"
        }
      },
      message: {
        message_id: "om_test",
        chat_id: "oc_test",
        chat_type: "p2p",
        content: "{\"text\":\"hello\"}"
      }
    }
  });

  assert.equal(result.kind, "message");
  if (result.kind !== "message") {
    return;
  }

  assert.equal(result.message.chatId, "oc_test");
  assert.equal(result.message.text, "hello");
});
