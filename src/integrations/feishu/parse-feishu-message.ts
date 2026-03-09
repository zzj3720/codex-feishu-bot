import type { IncomingChatMessage } from "../../domain/types.js";

type UnknownRecord = Record<string, unknown>;

export interface FeishuMessageParseFailure {
  reason: string;
  shape?: string;
}

type ParseFeishuMessageResult =
  | {
      ok: true;
      message: IncomingChatMessage;
    }
  | {
      ok: false;
      failure: FeishuMessageParseFailure;
    };

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pickObject(record: UnknownRecord, keys: string[]): UnknownRecord | undefined {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return undefined;
}

function pickString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function pickMentions(record: UnknownRecord): Array<UnknownRecord> | undefined {
  const mentions = record.mentions;
  if (!Array.isArray(mentions)) {
    return undefined;
  }

  return mentions.filter(isRecord);
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content) as { text?: string };
      return parsed.text?.trim() || content;
    } catch {
      return content;
    }
  }

  if (!isRecord(content)) {
    return "";
  }

  return pickString(content, ["text", "plain_text", "content"]) ?? "";
}

function summarizeShape(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return typeof body;
  }

  const message = pickObject(body, ["message"]);
  const event = pickObject(body, ["event"]);
  const eventMessage = event ? pickObject(event, ["message"]) : undefined;

  return JSON.stringify({
    rootKeys: Object.keys(body).slice(0, 10),
    messageKeys: message ? Object.keys(message).slice(0, 10) : undefined,
    eventKeys: event ? Object.keys(event).slice(0, 10) : undefined,
    eventMessageKeys: eventMessage ? Object.keys(eventMessage).slice(0, 10) : undefined
  });
}

export function summarizeFeishuPayload(body: unknown): string | undefined {
  return summarizeShape(body);
}

function normalizeEventBody(
  body: unknown
): {
  tenantKey?: string;
  senderId: string;
  senderType: string;
  messageId: string;
  chatId: string;
  chatType: string;
  content: unknown;
  mentions: Array<UnknownRecord>;
} | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const event = pickObject(body, ["event"]);
  const header = pickObject(body, ["header"]);
  const scope = event ?? body;
  const message = pickObject(scope, ["message"]) ?? pickObject(body, ["message"]);

  if (!message) {
    return undefined;
  }

  const messageId =
    pickString(message, ["message_id", "messageId", "id"]) ??
    pickString(scope, ["message_id", "messageId"]);
  const chatId =
    pickString(message, ["chat_id", "chatId", "open_chat_id", "conversation_id"]) ??
    pickString(scope, ["chat_id", "chatId", "open_chat_id", "conversation_id"]);
  const chatType =
    pickString(message, ["chat_type", "chatType"]) ??
    pickString(scope, ["chat_type", "chatType"]) ??
    "group";

  const sender =
    pickObject(scope, ["sender"]) ??
    pickObject(body, ["sender"]) ??
    pickObject(scope, ["sender_id"]) ??
    pickObject(body, ["sender_id"]);
  const senderIdContainer = sender ? pickObject(sender, ["sender_id", "id"]) ?? sender : undefined;
  const senderType =
    (sender && pickString(sender, ["sender_type", "senderType", "type"])) ??
    "unknown";
  const senderId =
    (senderIdContainer &&
      pickString(senderIdContainer, ["open_id", "openId", "union_id", "unionId", "user_id", "userId"])) ??
    "unknown";

  const content =
    message.content ??
    pickObject(message, ["body"])?.content ??
    pickObject(message, ["body"])?.text ??
    message.plain_text ??
    message.text;
  const mentions = pickMentions(message) ?? pickMentions(scope) ?? [];
  const tenantKey =
    pickString(scope, ["tenant_key", "tenantKey"]) ??
    pickString(header ?? {}, ["tenant_key", "tenantKey"]) ??
    pickString(body, ["tenant_key", "tenantKey"]);

  if (!messageId || !chatId || content === undefined) {
    return undefined;
  }

  return {
    tenantKey,
    senderId,
    senderType,
    messageId,
    chatId,
    chatType,
    content,
    mentions
  };
}

export function parseFeishuMessageEvent(body: unknown): IncomingChatMessage | undefined {
  const result = parseFeishuMessageEventResult(body);
  return result.ok ? result.message : undefined;
}

export function parseFeishuMessageEventResult(body: unknown): ParseFeishuMessageResult {
  const normalized = normalizeEventBody(body);
  if (!normalized) {
    return {
      ok: false,
      failure: {
        reason: "payload 不包含可识别的消息字段",
        shape: summarizeShape(body)
      }
    };
  }

  return {
    ok: true,
    message: {
      chatId: normalized.chatId,
      chatType: normalized.chatType,
      messageId: normalized.messageId,
      senderId: normalized.senderId,
      senderName: normalized.senderId,
      senderType: normalized.senderType,
      tenantKey: normalized.tenantKey,
      text: extractText(normalized.content),
      mentionsBot: normalized.mentions.length > 0,
      raw: body
    }
  };
}
