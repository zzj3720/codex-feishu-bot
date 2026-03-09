import type { ConversationItem } from "../domain/types.js";

export class ConversationStore {
  private readonly items = new Map<string, ConversationItem>();

  constructor(private readonly onChange?: () => void) {}

  private makeKey(runId: string, itemId: string): string {
    return `${runId}:${itemId}`;
  }

  get(runId: string, itemId: string): ConversationItem | undefined {
    return this.items.get(this.makeKey(runId, itemId));
  }

  save(item: ConversationItem): ConversationItem {
    this.items.set(this.makeKey(item.runId, item.itemId), item);
    this.onChange?.();
    return item;
  }

  update(
    runId: string,
    itemId: string,
    patch: Partial<ConversationItem>
  ): ConversationItem | undefined {
    const current = this.get(runId, itemId);
    if (!current) {
      return undefined;
    }

    const next: ConversationItem = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.save(next);
    return next;
  }

  listByRun(runId: string): ConversationItem[] {
    return Array.from(this.items.values())
      .filter((item) => item.runId === runId)
      .sort((left, right) => left.order - right.order);
  }

  list(): ConversationItem[] {
    return Array.from(this.items.values()).sort((left, right) => {
      if (left.runId === right.runId) {
        return left.order - right.order;
      }
      return left.runId.localeCompare(right.runId);
    });
  }

  replaceAll(items: ConversationItem[]): void {
    this.items.clear();
    for (const item of items) {
      this.items.set(this.makeKey(item.runId, item.itemId), item);
    }
  }
}
