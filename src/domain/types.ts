export interface IncomingChatMessage {
  chatId: string;
  chatType: string;
  messageId: string;
  senderId: string;
  senderName: string;
  senderType: string;
  tenantKey?: string;
  text: string;
  mentionsBot: boolean;
  raw: unknown;
}

export interface ChatSession {
  chatId: string;
  threadId: string;
  workspaceId: string;
  activeRunId?: string;
  activeTurnId?: string;
  updatedAt: string;
}

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface RunRecord {
  runId: string;
  chatId: string;
  threadId: string;
  sourceMessageId: string;
  status: RunStatus;
  errorMessage?: string;
  startedAt: string;
  updatedAt: string;
}

export type ConversationItemKind = "assistant_text" | "tool_card" | "artifact_file";
export type ConversationItemPhase = "queued" | "streaming" | "completed" | "failed";
export type ConversationItemSource = "commentary" | "final_answer" | "tool" | "artifact";

export interface ConversationItem {
  runId: string;
  chatId: string;
  sourceMessageId: string;
  itemId: string;
  order: number;
  kind: ConversationItemKind;
  source: ConversationItemSource;
  phase: ConversationItemPhase;
  title?: string;
  content?: string;
  command?: string;
  output?: string;
  details: string[];
  filePaths: string[];
  artifactPath?: string;
  feishuMessageId?: string;
  deliveredContentHash?: string;
  createdAt: string;
  updatedAt: string;
}

export type CodexEvent =
  | {
      kind: "thread_bound";
      threadId: string;
    }
  | {
      kind: "turn_bound";
      turnId: string;
    }
  | {
      kind: "run_status";
      status: RunStatus;
      detail?: string;
    }
  | {
      kind: "assistant_message_started";
      itemId: string;
      source: Extract<ConversationItemSource, "commentary" | "final_answer">;
    }
  | {
      kind: "assistant_message_delta";
      itemId: string;
      text: string;
    }
  | {
      kind: "assistant_message_completed";
      itemId: string;
      text: string;
    }
  | {
      kind: "tool_call_started";
      itemId: string;
      title: string;
      command?: string;
    }
  | {
      kind: "tool_call_delta";
      itemId: string;
      detail?: string;
      output?: string;
      path?: string;
    }
  | {
      kind: "tool_call_completed";
      itemId: string;
      title?: string;
      status: "completed" | "failed";
      output?: string;
      paths?: string[];
    }
  | {
      kind: "artifact_ready";
      itemId: string;
      title?: string;
      path: string;
    }
  | {
      kind: "error";
      message: string;
    };
