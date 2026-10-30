/**
 * One command for local development: the API server (restarts on change) and the
 * Vite dev server (instant UI reload). Open http://localhost:5173.
 */
import { spawn, type ChildProcess } from "node:child_process";

const children: ChildProcess[] = [];
const env = { ...process.env, HOOD_RIVALS_DEV_UI: "1" };
const run = (name: string, args: string[]) => {
  const child = spawn(process.execPath, args, { stdio: "inherit", env });
  child.on("exit", (code) => {
    if (code) console.error(`${name} exited with code ${code}`);
    shutdown(code ?? 0);
  });
  children.push(child);
};
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

run("api", ["--import", "tsx", "--watch", "server/index.ts"]);
run("ui", ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"]);
console.log("\n  Hood Rivals dev: open http://localhost:5173 (API on :3000)\n");
