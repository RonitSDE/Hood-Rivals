// Runs before `npm start` and `npm run dev`. Plain JavaScript so it works even when
// dependencies are missing. Explains the common reasons the app will not start.
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";

const problems = [];
const say = (title, fix) => problems.push(`  ✖ ${title}\n    → ${fix}`);

// 1. Node version: node:sqlite (the game database) needs Node 22.13+.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13))
  say(
    `Node ${process.versions.node} is too old (the game database needs Node 22.13 or newer; Node 24 recommended).`,
    "Install Node 24 from https://nodejs.org or run `nvm install 24 && nvm use 24`, then `npm ci`.",
  );

// 2. Dependencies installed and matching package-lock.json.
const dev = process.argv.includes("--dev");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")).packages ?? {};
const wanted = Object.keys({ ...pkg.dependencies, ...(dev ? pkg.devDependencies : {}) });
const missing = [];
const outdated = [];
for (const name of wanted) {
  const path = `node_modules/${name}/package.json`;
  if (!existsSync(path)) missing.push(name);
  else if (
    lock[`node_modules/${name}`]?.version &&
    JSON.parse(readFileSync(path, "utf8")).version !== lock[`node_modules/${name}`].version
  )
    outdated.push(name);
}
if (missing.length)
  say(
    `Dependencies are not installed (missing: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}).`,
    "Run `npm ci`.",
  );
else if (outdated.length)
  say(
    `Installed packages don't match package-lock.json (${outdated.slice(0, 4).join(", ")}).`,
    "Run `npm ci`.",
  );

// 3. .env present.
if (!existsSync(".env") && process.env.NODE_ENV !== "production")
  say("No .env file.", "Run `cp .env.example .env`.");

// 4. Ports free.
const port = Number(
  process.env.PORT || (existsSync(".env") && /^PORT=(\d+)/m.exec(readFileSync(".env", "utf8"))?.[1]) || 3000,
);
const ports = dev ? [port, 5173] : [port];
for (const p of ports) {
  const free = await new Promise((resolve) => {
    const server = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => server.close(() => resolve(true)));
    server.listen(p);
  });
  if (!free)
    say(
      `Port ${p} is already in use — probably an earlier Hood Rivals server is still running.`,
      `Stop it (Ctrl+C in its terminal, or \`lsof -ti :${p} | xargs kill\`), then try again.`,
    );
}

if (problems.length) {
  console.error(`\nHood Rivals can't start yet:\n\n${problems.join("\n\n")}\n`);
  process.exit(1);
}
