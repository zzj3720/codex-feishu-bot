import { randomUUID } from "node:crypto";

import type { RunRecord, RunStatus } from "../domain/types.js";

interface CreateRunInput {
  chatId: string;
  threadId: string;
  sourceMessageId: string;
}

export class RunStore {
  private readonly runs = new Map<string, RunRecord>();

  constructor(private readonly onChange?: () => void) {}

  create(input: CreateRunInput): RunRecord {
    const now = new Date().toISOString();
    const run: RunRecord = {
      runId: randomUUID(),
      chatId: input.chatId,
      threadId: input.threadId,
      sourceMessageId: input.sourceMessageId,
      status: "queued",
      startedAt: now,
      updatedAt: now
    };

    this.runs.set(run.runId, run);
    this.onChange?.();
    return run;
  }

  get(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  save(run: RunRecord): RunRecord {
    this.runs.set(run.runId, run);
    this.onChange?.();
    return run;
  }

  update(runId: string, patch: Partial<RunRecord>): RunRecord | undefined {
    const current = this.runs.get(runId);
    if (!current) {
      return undefined;
    }

    const next: RunRecord = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.runs.set(runId, next);
    this.onChange?.();
    return next;
  }

  setStatus(runId: string, status: RunStatus, errorMessage?: string): RunRecord | undefined {
    return this.update(runId, {
      status,
      errorMessage
    });
  }

  list(): RunRecord[] {
    return Array.from(this.runs.values());
  }

  replaceAll(runs: RunRecord[]): void {
    this.runs.clear();
    for (const run of runs) {
      this.runs.set(run.runId, run);
    }
  }
}
