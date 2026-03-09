import type { ConversationItem } from "../../domain/types.js";
import {
  renderAssistantCardContent,
  renderFileMessageContent,
  renderTextMessageContent,
  renderToolCardContent
} from "./feishu-card-renderer.js";

export interface FeishuMessageClient {
  sendText(input: { chatId: string; content: string }): Promise<string>;
  updateText(input: { messageId: string; content: string }): Promise<void>;
  sendCard(input: { chatId: string; content: string }): Promise<string>;
  updateCard(input: { messageId: string; content: string }): Promise<void>;
  sendFile(input: { chatId: string; path: string; fileName?: string }): Promise<string>;
}

export class ConsoleFeishuMessageClient implements FeishuMessageClient {
  async sendText(input: { chatId: string; content: string }): Promise<string> {
    const messageId = `text_${Date.now()}`;
    console.log(
      `[Feishu Text Send] ${messageId}\n${JSON.stringify(
        {
          chatId: input.chatId,
          content: JSON.parse(renderTextMessageContent(input.content))
        },
        null,
        2
      )}`
    );
    return messageId;
  }

  async updateText(input: { messageId: string; content: string }): Promise<void> {
    console.log(
      `[Feishu Text Update] ${input.messageId}\n${JSON.stringify(
        {
          content: JSON.parse(renderTextMessageContent(input.content))
        },
        null,
        2
      )}`
    );
  }

  async sendCard(input: { chatId: string; content: string }): Promise<string> {
    const messageId = `card_${Date.now()}`;
    console.log(
      `[Feishu Card Send] ${messageId}\n${JSON.stringify(
        {
          chatId: input.chatId,
          content: JSON.parse(input.content)
        },
        null,
        2
      )}`
    );
    return messageId;
  }

  async updateCard(input: { messageId: string; content: string }): Promise<void> {
    console.log(
      `[Feishu Card Update] ${input.messageId}\n${JSON.stringify(JSON.parse(input.content), null, 2)}`
    );
  }

  async sendFile(input: { chatId: string; path: string; fileName?: string }): Promise<string> {
    const messageId = `file_${Date.now()}`;
    console.log(
      `[Feishu File Send] ${messageId}\n${JSON.stringify(
        {
          chatId: input.chatId,
          path: input.path,
          fileName: input.fileName,
          content: JSON.parse(renderFileMessageContent("file_key_mock"))
        },
        null,
        2
      )}`
    );
    return messageId;
  }
}

export function renderConversationItem(item: ConversationItem): string {
  switch (item.kind) {
    case "assistant_text":
      return renderAssistantCardContent(item);
    case "tool_card":
      return renderToolCardContent(item);
    case "artifact_file":
      return renderFileMessageContent(item.itemId);
  }
}
