import { createApp } from "./app";
import { config } from "./config";
import { buildStatus } from "./static";
const runtime = createApp();
const server = runtime.app.listen(config.port, () => {
  console.log(`Hood Rivals API on :${config.port}`);
  if (!process.env.HOOD_RIVALS_DEV_UI) {
    const problem = buildStatus();
    if (problem) console.warn(`\n  ⚠ ${problem}\n`);
    else console.log(`Open http://localhost:${config.port}`);
  }
});
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE")
    console.error(
      `\n  ✖ Port ${config.port} is already in use. Stop the other server (or set PORT in .env) and try again.\n`,
    );
  else console.error(error);
  process.exit(1);
});
runtime.store.check().then((s) => console.log("Checkout:", s.reason));
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      runtime.close();
      process.exit(0);
    }),
  );
