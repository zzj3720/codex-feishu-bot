import type { FastifyInstance } from "fastify";

import { ChatOrchestrator } from "../services/chat-orchestrator.js";

export async function registerDebugRoutes(
  app: FastifyInstance,
  dependencies: {
    orchestrator: ChatOrchestrator;
  }
): Promise<void> {
  app.get("/debug/state", async () => {
    return dependencies.orchestrator.getDebugState();
  });
}
