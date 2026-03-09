import type { FastifyInstance } from "fastify";

import { parseFeishuWebhook } from "../integrations/feishu/parse-feishu-event.js";
import { ChatOrchestrator } from "../services/chat-orchestrator.js";

export async function registerFeishuRoutes(
  app: FastifyInstance,
  dependencies: {
    orchestrator: ChatOrchestrator;
  }
): Promise<void> {
  app.post("/webhooks/feishu", async (request, reply) => {
    const parsed = parseFeishuWebhook(request.body);

    if (parsed.kind === "challenge") {
      app.log.info("收到飞书 challenge 请求");
      return {
        challenge: parsed.challenge
      };
    }

    if (parsed.kind === "unsupported") {
      app.log.warn(
        {
          reason: parsed.reason,
          body: request.body
        },
        "收到未支持的飞书 webhook"
      );
      reply.code(202);
      return {
        accepted: false,
        reason: parsed.reason
      };
    }

    app.log.info(
      {
        chatId: parsed.message.chatId,
        messageId: parsed.message.messageId,
        chatType: parsed.message.chatType,
        senderId: parsed.message.senderId
      },
      "收到飞书 webhook 消息"
    );
    dependencies.orchestrator.enqueue(parsed.message);

    reply.code(202);
    return {
      accepted: true,
      chatId: parsed.message.chatId,
      messageId: parsed.message.messageId
    };
  });
}
