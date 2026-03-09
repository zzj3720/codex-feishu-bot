import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return {
      ok: true,
      timestamp: new Date().toISOString()
    };
  });
}
