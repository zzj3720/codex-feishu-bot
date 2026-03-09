import assert from "node:assert/strict";
import test from "node:test";

import { FeishuSdkMessageClient } from "./feishu-sdk-message-client.js";

test("FeishuSdkMessageClient rejects non-zero text send response codes", async () => {
  const client = new FeishuSdkMessageClient(
    {
      im: {
        v1: {
          message: {
            create: async () => ({
              code: 99991663,
              msg: "no permission"
            })
          }
        }
      }
    } as never,
    console
  );

  await assert.rejects(
    client.sendText({
      chatId: "oc_chat_1",
      content: "hello"
    }),
    /飞书 发送文本消息 失败: \[99991663\] no permission/
  );
});

test("FeishuSdkMessageClient sends text message with JSON payload", async () => {
  let createPayload: unknown;

  const client = new FeishuSdkMessageClient(
    {
      im: {
        v1: {
          message: {
            create: async (payload: unknown) => {
              createPayload = payload;
              return {
                code: 0,
                data: {
                  message_id: "om_message_1"
                }
              };
            }
          }
        }
      }
    } as never,
    console
  );

  const messageId = await client.sendText({
    chatId: "oc_chat_1",
    content: "done"
  });

  assert.equal(messageId, "om_message_1");
  assert.deepEqual(createPayload, {
    params: {
      receive_id_type: "chat_id"
    },
    data: {
      receive_id: "oc_chat_1",
      content: "{\"text\":\"done\"}",
      msg_type: "text"
    }
  });
});

test("FeishuSdkMessageClient updates text with message.update", async () => {
  let updatePayload: unknown;

  const client = new FeishuSdkMessageClient(
    {
      im: {
        v1: {
          message: {
            update: async (payload: unknown) => {
              updatePayload = payload;
              return {
                code: 0
              };
            }
          }
        }
      }
    } as never,
    console
  );

  await client.updateText({
    messageId: "om_text_1",
    content: "processing..."
  });

  assert.deepEqual(updatePayload, {
    path: {
      message_id: "om_text_1"
    },
    data: {
      content: "{\"text\":\"processing...\"}",
      msg_type: "text"
    }
  });
});

test("FeishuSdkMessageClient patches card without msg_type", async () => {
  let patchPayload: unknown;

  const client = new FeishuSdkMessageClient(
    {
      im: {
        v1: {
          message: {
            patch: async (payload: unknown) => {
              patchPayload = payload;
              return {
                code: 0
              };
            }
          }
        }
      }
    } as never,
    console
  );

  await client.updateCard({
    messageId: "om_card_1",
    content: "{\"config\":{\"update_multi\":true}}"
  });

  assert.deepEqual(patchPayload, {
    path: {
      message_id: "om_card_1"
    },
    data: {
      content: "{\"config\":{\"update_multi\":true}}"
    }
  });
});
