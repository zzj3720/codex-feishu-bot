import type { ChatSession, CodexEvent, IncomingChatMessage } from "../../domain/types.js";

export interface CodexTurnContext {
  session?: ChatSession;
  workspaceId: string;
  message: IncomingChatMessage;
}

export interface CodexWorker {
  start?(): Promise<void>;
  close?(): Promise<void>;
  ensureThread(context: CodexTurnContext): Promise<string>;
  steerTurn?(context: CodexTurnContext & { threadId: string; turnId: string }): Promise<void>;
  runTurn(context: CodexTurnContext & { threadId: string }): AsyncGenerator<CodexEvent>;
}
