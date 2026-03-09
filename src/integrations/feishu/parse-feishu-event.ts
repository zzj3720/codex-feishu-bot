import { z } from "zod";

import type { IncomingChatMessage } from "../../domain/types.js";
import { parseFeishuMessageEventResult } from "./parse-feishu-message.js";

const verificationSchema = z.object({
  challenge: z.string(),
  type: z.string().optional()
});

export type FeishuWebhookParseResult =
  | {
      kind: "challenge";
      challenge: string;
    }
  | {
      kind: "message";
      message: IncomingChatMessage;
    }
  | {
      kind: "unsupported";
      reason: string;
    };

export function parseFeishuWebhook(body: unknown): FeishuWebhookParseResult {
  const verificationResult = verificationSchema.safeParse(body);
  if (verificationResult.success) {
    return {
      kind: "challenge",
      challenge: verificationResult.data.challenge
    };
  }

  const parsed = parseFeishuMessageEventResult(body);
  if (!parsed.ok) {
    return {
      kind: "unsupported",
      reason: parsed.failure.reason
    };
  }

  return {
    kind: "message",
    message: parsed.message
  };
}
