import { buildApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
const { app, close } = await buildApp(config);

await app.listen({ host: config.host, port: config.port });
app.log.info(`Ghostel server listening on http://${config.host}:${config.port}`);
if (!config.production) console.log(`Ghostel server ready on http://${config.host}:${config.port}`);

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}
