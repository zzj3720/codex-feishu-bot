import * as Lark from "@larksuiteoapi/node-sdk";

import type { Env } from "../../config/env.js";
import type { IncomingChatMessage } from "../../domain/types.js";
import { createFeishuWsClient } from "./feishu-openapi-client.js";
import {
  parseFeishuMessageEventResult,
  summarizeFeishuPayload
} from "./parse-feishu-message.js";

interface LoggerLike {
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

interface FeishuWsSubscriberParams {
  env: Env;
  onMessage: (message: IncomingChatMessage) => void;
  logger: LoggerLike;
}

export class FeishuWsSubscriber {
  private readonly wsClient;
  private readonly eventDispatcher;

  constructor(private readonly params: FeishuWsSubscriberParams) {
    this.wsClient = createFeishuWsClient(params.env);
    this.eventDispatcher = new Lark.EventDispatcher({}).register({
      "im.message.receive_v1": (data) => {
        const parsed = parseFeishuMessageEventResult(data);
        if (!parsed.ok) {
          this.params.logger.warn(
            {
              failure: parsed.failure,
              payloadShape: summarizeFeishuPayload(data)
            },
            "忽略无法解析的飞书消息事件"
          );
          return;
        }

        this.params.logger.info(
          {
            chatId: parsed.message.chatId,
            messageId: parsed.message.messageId,
            chatType: parsed.message.chatType,
            textPreview: parsed.message.text.slice(0, 120)
          },
          "收到飞书消息事件"
        );
        this.params.onMessage(parsed.message);
      }
    });
  }

  async start(): Promise<void> {
    this.params.logger.info("正在建立飞书 WebSocket 长连接");
    await this.wsClient.start({
      eventDispatcher: this.eventDispatcher
    });
    this.params.logger.info("飞书 WebSocket 长连接已启动");
  }

  async close(): Promise<void> {
    this.wsClient.close();
    this.params.logger.info("飞书 WebSocket 长连接已关闭");
  }
}
