import { buildApp } from "./app.js";

const host = process.env.VAEXCORE_PULSE_API_HOST ?? "127.0.0.1";
const port = Number(process.env.VAEXCORE_PULSE_API_PORT ?? "4010");

const app = await buildApp();
app.log.level = "info";

app.listen({ host, port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
