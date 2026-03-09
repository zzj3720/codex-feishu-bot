import { basename } from "node:path";

import {
  renderFileMessageContent,
  renderTextMessageContent
} from "./feishu-card-renderer.js";
import type { FeishuMessageClient } from "./feishu-message-client.js";

interface FakeFeishuResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

export class FakeFeishuMessageClient implements FeishuMessageClient {
  constructor(private readonly baseUrl: string) {}

  async sendText(input: { chatId: string; content: string }): Promise<string> {
    const response = await this.request<{ message_id: string }>(
      `/open-apis/im/v1/messages?receive_id_type=chat_id`,
      {
        method: "POST",
        body: {
          receive_id: input.chatId,
          content: renderTextMessageContent(input.content),
          msg_type: "text"
        }
      }
    );

    return response.message_id;
  }

  async updateText(input: { messageId: string; content: string }): Promise<void> {
    await this.request(`/open-apis/im/v1/messages/${input.messageId}`, {
      method: "PUT",
      body: {
        content: renderTextMessageContent(input.content),
        msg_type: "text"
      }
    });
  }

  async sendCard(input: { chatId: string; content: string }): Promise<string> {
    const response = await this.request<{ message_id: string }>(
      `/open-apis/im/v1/messages?receive_id_type=chat_id`,
      {
        method: "POST",
        body: {
          receive_id: input.chatId,
          content: input.content,
          msg_type: "interactive"
        }
      }
    );

    return response.message_id;
  }

  async updateCard(input: { messageId: string; content: string }): Promise<void> {
    await this.request(`/open-apis/im/v1/messages/${input.messageId}`, {
      method: "PATCH",
      body: {
        content: input.content
      }
    });
  }

  async sendFile(input: { chatId: string; path: string; fileName?: string }): Promise<string> {
    const upload = await this.request<{ file_key: string }>("/open-apis/im/v1/files", {
      method: "POST",
      body: {
        file_name: input.fileName ?? basename(input.path),
        path: input.path
      }
    });

    const response = await this.request<{ message_id: string }>(
      `/open-apis/im/v1/messages?receive_id_type=chat_id`,
      {
        method: "POST",
        body: {
          receive_id: input.chatId,
          content: renderFileMessageContent(upload.file_key),
          msg_type: "file"
        }
      }
    );

    return response.message_id;
  }

  private async request<T>(
    path: string,
    options: {
      method: string;
      body?: unknown;
    }
  ): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method: options.method,
      headers: {
        "content-type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`fake Feishu 请求失败: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as FakeFeishuResponse<T>;
    if (payload.code !== 0 || !payload.data) {
      throw new Error(payload.msg ?? "fake Feishu 返回异常响应");
    }

    return payload.data;
  }
}
