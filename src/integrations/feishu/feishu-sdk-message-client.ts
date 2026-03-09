import { createReadStream } from "node:fs";

import type { Client } from "@larksuiteoapi/node-sdk";

import { renderFileMessageContent, renderTextMessageContent } from "./feishu-card-renderer.js";
import { resolveFeishuFileName, resolveFeishuFileType } from "./feishu-attachment.js";
import type { FeishuMessageClient } from "./feishu-message-client.js";

interface LoggerLike {
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

interface FeishuApiResponse<T = unknown> {
  code?: number;
  msg?: string;
  data?: T;
}

export class FeishuSdkMessageClient implements FeishuMessageClient {
  constructor(
    private readonly client: Client,
    private readonly logger: LoggerLike
  ) {}

  private assertSuccess<T>(
    operation: string,
    response: FeishuApiResponse<T>
  ): asserts response is FeishuApiResponse<T> & { code: 0 } {
    if (response.code === 0 || response.code === undefined) {
      return;
    }

    throw new Error(`飞书 ${operation} 失败: [${response.code}] ${response.msg ?? "unknown error"}`);
  }

  async sendText(input: { chatId: string; content: string }): Promise<string> {
    const response = (await this.client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id"
      },
      data: {
        receive_id: input.chatId,
        content: renderTextMessageContent(input.content),
        msg_type: "text"
      }
    })) as FeishuApiResponse<{ message_id?: string }>;
    this.assertSuccess("发送文本消息", response);

    const messageId = response.data?.message_id;
    if (!messageId) {
      throw new Error("飞书发送文本消息失败，响应里没有 message_id");
    }

    this.logger.info(
      {
        chatId: input.chatId,
        messageId
      },
      "飞书文本消息发送成功"
    );
    return messageId;
  }

  async updateText(input: { messageId: string; content: string }): Promise<void> {
    const response = (await this.client.im.v1.message.update({
      path: {
        message_id: input.messageId
      },
      data: {
        msg_type: "text",
        content: renderTextMessageContent(input.content)
      }
    })) as FeishuApiResponse;
    this.assertSuccess("更新文本消息", response);
    this.logger.info(
      {
        messageId: input.messageId
      },
      "飞书文本消息更新成功"
    );
  }

  async sendCard(input: { chatId: string; content: string }): Promise<string> {
    const response = (await this.client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id"
      },
      data: {
        receive_id: input.chatId,
        content: input.content,
        msg_type: "interactive"
      }
    })) as FeishuApiResponse<{ message_id?: string }>;
    this.assertSuccess("发送卡片消息", response);

    const messageId = response.data?.message_id;
    if (!messageId) {
      throw new Error("飞书发送卡片消息失败，响应里没有 message_id");
    }

    this.logger.info(
      {
        chatId: input.chatId,
        messageId
      },
      "飞书卡片消息发送成功"
    );
    return messageId;
  }

  async updateCard(input: { messageId: string; content: string }): Promise<void> {
    const response = (await this.client.im.v1.message.patch({
      path: {
        message_id: input.messageId
      },
      data: {
        content: input.content
      }
    })) as FeishuApiResponse;
    this.assertSuccess("更新卡片消息", response);
    this.logger.info(
      {
        messageId: input.messageId
      },
      "飞书卡片消息更新成功"
    );
  }

  async sendFile(input: { chatId: string; path: string; fileName?: string }): Promise<string> {
    const upload = await this.client.im.v1.file.create({
      data: {
        file_type: resolveFeishuFileType(input.path),
        file_name: resolveFeishuFileName(input.path, input.fileName),
        file: createReadStream(input.path)
      }
    });

    const fileKey = upload?.file_key;
    if (!fileKey) {
      throw new Error("飞书文件上传失败，响应里没有 file_key");
    }

    const response = (await this.client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id"
      },
      data: {
        receive_id: input.chatId,
        content: renderFileMessageContent(fileKey),
        msg_type: "file"
      }
    })) as FeishuApiResponse<{ message_id?: string }>;
    this.assertSuccess("发送文件消息", response);

    const messageId = response.data?.message_id;
    if (!messageId) {
      throw new Error("飞书发送文件消息失败，响应里没有 message_id");
    }

    this.logger.info(
      {
        chatId: input.chatId,
        messageId,
        fileKey,
        path: input.path
      },
      "飞书文件消息发送成功"
    );
    return messageId;
  }
}
