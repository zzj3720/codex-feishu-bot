import { createHash } from "node:crypto";

import type { ConversationItem } from "../domain/types.js";
import { renderConversationItem } from "../integrations/feishu/feishu-message-client.js";
import type { FeishuMessageClient } from "../integrations/feishu/feishu-message-client.js";
import { ConversationStore } from "../stores/conversation-store.js";

interface LoggerLike {
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

export class ConversationDeliveryService {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly feishuClient: FeishuMessageClient,
    private readonly conversationStore: ConversationStore,
    private readonly debounceMs: number,
    private readonly logger: LoggerLike
  ) {}

  schedule(item: ConversationItem): void {
    const key = this.makeKey(item.runId, item.itemId);
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.flush(item.runId, item.itemId).catch((error) => {
        this.logger.error(
          {
            runId: item.runId,
            itemId: item.itemId,
            error: error instanceof Error ? error.message : String(error)
          },
          "同步飞书消息槽位失败"
        );
      });
    }, this.debounceMs);

    this.timers.set(key, timer);
  }

  async flush(runId: string, itemId: string): Promise<void> {
    const key = this.makeKey(runId, itemId);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    const previous = this.inFlight.get(key) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const item = this.conversationStore.get(runId, itemId);
        if (!item) {
          return;
        }

        await this.deliver(item);
      });

    this.inFlight.set(key, current);

    try {
      await current;
    } finally {
      if (this.inFlight.get(key) === current) {
        this.inFlight.delete(key);
      }
    }
  }

  async flushRun(runId: string): Promise<void> {
    const items = this.conversationStore.listByRun(runId);
    for (const item of items) {
      await this.flush(item.runId, item.itemId);
    }
  }

  private async deliver(item: ConversationItem): Promise<void> {
    if (item.kind === "assistant_text") {
      await this.deliverTextItem(item);
      return;
    }

    if (item.kind === "tool_card") {
      await this.deliverToolItem(item);
      return;
    }

    if (item.kind === "artifact_file") {
      await this.deliverArtifactItem(item);
    }
  }

  private async deliverTextItem(item: ConversationItem): Promise<void> {
    const content = item.content?.trim();
    if (!content) {
      return;
    }

    const cardContent = renderConversationItem(item);
    const nextHash = this.hashContent("assistant_card", cardContent);
    if (item.deliveredContentHash === nextHash) {
      return;
    }

    if (!item.feishuMessageId) {
      const messageId = await this.feishuClient.sendCard({
        chatId: item.chatId,
        content: cardContent
      });
      this.conversationStore.update(item.runId, item.itemId, {
        feishuMessageId: messageId,
        deliveredContentHash: nextHash
      });
      return;
    }

    await this.feishuClient.updateCard({
      messageId: item.feishuMessageId,
      content: cardContent
    });
    this.conversationStore.update(item.runId, item.itemId, {
      deliveredContentHash: nextHash
    });
  }

  private async deliverToolItem(item: ConversationItem): Promise<void> {
    const content = renderConversationItem(item);
    const nextHash = this.hashContent("card", content);
    if (item.deliveredContentHash === nextHash) {
      return;
    }

    if (!item.feishuMessageId) {
      const messageId = await this.feishuClient.sendCard({
        chatId: item.chatId,
        content
      });
      this.conversationStore.update(item.runId, item.itemId, {
        feishuMessageId: messageId,
        deliveredContentHash: nextHash
      });
      return;
    }

    await this.feishuClient.updateCard({
      messageId: item.feishuMessageId,
      content
    });
    this.conversationStore.update(item.runId, item.itemId, {
      deliveredContentHash: nextHash
    });
  }

  private async deliverArtifactItem(item: ConversationItem): Promise<void> {
    if (!item.artifactPath || item.feishuMessageId) {
      return;
    }

    const messageId = await this.feishuClient.sendFile({
      chatId: item.chatId,
      path: item.artifactPath,
      fileName: item.title
    });
    this.conversationStore.update(item.runId, item.itemId, {
      feishuMessageId: messageId,
      deliveredContentHash: this.hashContent("file", item.artifactPath)
    });
  }

  private makeKey(runId: string, itemId: string): string {
    return `${runId}:${itemId}`;
  }

  private hashContent(kind: string, content: string): string {
    return createHash("sha1").update(kind).update("\u0000").update(content).digest("hex");
  }
}
