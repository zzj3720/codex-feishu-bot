import type { RawData } from "ws";
import WebSocket from "ws";

import type { Env } from "../../config/env.js";
import type { IncomingChatMessage } from "../../domain/types.js";
import { parseFeishuMessageEventResult } from "./parse-feishu-message.js";

interface LoggerLike {
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

interface FakeFeishuEnvelope {
  type?: string;
  event?: unknown;
}

interface FakeFeishuWsSubscriberParams {
  env: Env;
  onMessage: (message: IncomingChatMessage) => void;
  logger: LoggerLike;
}

export class FakeFeishuWsSubscriber {
  private socket?: WebSocket;
  private closed = false;
  private reconnectTimer?: NodeJS.Timeout;
  private isConnecting = false;

  constructor(private readonly params: FakeFeishuWsSubscriberParams) {}

  async start(): Promise<void> {
    this.closed = false;
    await this.connectUntilReady();
  }

  async close(): Promise<void> {
    this.closed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.socket?.removeAllListeners();
    this.socket?.close();
    this.socket = undefined;
    this.params.logger.info("fake Feishu WebSocket 已关闭");
  }

  private async connectUntilReady(): Promise<void> {
    while (!this.closed) {
      try {
        await this.connectOnce();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.params.logger.warn("连接 fake Feishu WebSocket 失败，稍后重试: %s", message);
        await new Promise<void>((resolve) => {
          this.reconnectTimer = setTimeout(resolve, 1000);
        });
      }
    }
  }

  private async connectOnce(): Promise<void> {
    if (this.isConnecting || this.closed) {
      return;
    }

    this.isConnecting = true;
    this.params.logger.info("正在连接 fake Feishu WebSocket: %s", this.params.env.FAKE_FEISHU_WS_URL);

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(this.params.env.FAKE_FEISHU_WS_URL);
        this.socket = socket;

        const handleError = (error: Error) => {
          socket.removeAllListeners();
          reject(error);
        };

        socket.once("open", () => {
          socket.off("error", handleError);
          resolve();
        });

        socket.once("error", handleError);

        socket.on("message", (payload: RawData) => {
          this.handleMessage(payload.toString("utf8"));
        });

        socket.on("close", () => {
          this.params.logger.warn("fake Feishu WebSocket 已断开");
          if (!this.closed) {
            void this.connectUntilReady();
          }
        });
      });

      this.params.logger.info("fake Feishu WebSocket 已连接");
    } finally {
      this.isConnecting = false;
    }
  }

  private handleMessage(payload: string): void {
    let envelope: FakeFeishuEnvelope;
    try {
      envelope = JSON.parse(payload) as FakeFeishuEnvelope;
    } catch {
      this.params.logger.warn("收到非 JSON 的 fake Feishu 消息");
      return;
    }

    if (envelope.type !== "im.message.receive_v1") {
      return;
    }

    const parsed = parseFeishuMessageEventResult(envelope.event);
    if (!parsed.ok) {
      this.params.logger.warn(
        {
          failure: parsed.failure,
          envelope
        },
        "忽略无法解析的 fake Feishu 事件"
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
      "收到 fake Feishu 消息事件"
    );
    this.params.onMessage(parsed.message);
  }
}
