import Fastify from "fastify";
import cors from "@fastify/cors";
import { bridgeRoutes } from "./routes/bridge.js";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profiles.js";
import { projectRoutes } from "./routes/projects.js";

export async function buildApp() {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(healthRoutes);
  await app.register(projectRoutes);
  await app.register(profileRoutes);
  await app.register(bridgeRoutes);

  app.get("/", async () => ({
    service: "HighlightSmith API bridge",
    status: "ok",
  }));

  return app;
}
