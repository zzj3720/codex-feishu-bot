import { buildAppRuntime } from "./app.js";
import { readEnv } from "./config/env.js";

async function main(): Promise<void> {
  const env = readEnv();
  const runtime = buildAppRuntime(env);
  const { app } = runtime;

  await app.listen({
    host: env.HOST,
    port: env.PORT
  });

  await runtime.startExternalServices();

  const shutdown = async (): Promise<void> => {
    await runtime.stopExternalServices();
    await app.close();
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
