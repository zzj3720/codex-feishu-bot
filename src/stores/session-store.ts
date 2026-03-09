import type { ChatSession } from "../domain/types.js";

export class SessionStore {
  private readonly sessions = new Map<string, ChatSession>();

  constructor(private readonly onChange?: () => void) {}

  get(chatId: string): ChatSession | undefined {
    return this.sessions.get(chatId);
  }

  save(session: ChatSession): ChatSession {
    this.sessions.set(session.chatId, session);
    this.onChange?.();
    return session;
  }

  attachRun(chatId: string, runId: string): void {
    const session = this.sessions.get(chatId);
    if (!session) {
      return;
    }

    this.sessions.set(chatId, {
      ...session,
      activeRunId: runId,
      updatedAt: new Date().toISOString()
    });
    this.onChange?.();
  }

  bindTurn(chatId: string, turnId: string): void {
    const session = this.sessions.get(chatId);
    if (!session) {
      return;
    }

    this.sessions.set(chatId, {
      ...session,
      activeTurnId: turnId,
      updatedAt: new Date().toISOString()
    });
    this.onChange?.();
  }

  releaseRun(chatId: string): void {
    const session = this.sessions.get(chatId);
    if (!session) {
      return;
    }

    this.sessions.set(chatId, {
      ...session,
      activeRunId: undefined,
      activeTurnId: undefined,
      updatedAt: new Date().toISOString()
    });
    this.onChange?.();
  }

  replaceAll(sessions: ChatSession[]): void {
    this.sessions.clear();
    for (const session of sessions) {
      this.sessions.set(session.chatId, session);
    }
  }

  list(): ChatSession[] {
    return Array.from(this.sessions.values());
  }
}
