// npm run e2e: start the local Supabase stack, build and start the app
// against it with fake posters, run every e2e/*.spec.mjs in a phone-sized
// Chrome, and report. Never touches the real Supabase project.
//
// Options: --no-build (reuse the last build), --only people (one spec).
// Needs Docker running and Google Chrome installed (or CHROME_PATH).

import { execFileSync, spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const run = (cmd, cmdArgs, env) => execFileSync(cmd, cmdArgs, { cwd: ROOT, env, encoding: "utf8" });

console.log("Starting local Supabase…");
run("npx", ["supabase", "start", "-x", "studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta"]);
const status = JSON.parse(run("npx", ["supabase", "status", "-o", "json"]));

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY,
  IMAGE_GENERATOR: "fake",
  GEMINI_API_KEY: "",
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};

if (!args.includes("--no-build")) {
  console.log("Building the app…");
  run("npx", ["next", "build"], env);
}

console.log(`Starting the app on ${BASE}…`);
const server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
for (let i = 0; ; i++) {
  if (await fetch(BASE + "/who/new").then((r) => r.ok, () => false)) break;
  if (i > 60) {
    server.kill();
    throw new Error(`The app didn't start:\n${serverLog}`);
  }
  await new Promise((r) => setTimeout(r, 500));
}

const specs = readdirSync(new URL(".", import.meta.url))
  .filter((f) => f.endsWith(".spec.mjs") && (!only || f.startsWith(only)))
  .sort();
const failed = [];
for (const spec of specs) {
  console.log(`\n── ${spec}`);
  const code = await new Promise((resolve) => {
    const child = spawn("node", [fileURLToPath(new URL(spec, import.meta.url))], {
      cwd: ROOT,
      env: { ...process.env, E2E_BASE_URL: BASE },
      stdio: "inherit",
    });
    child.on("exit", resolve);
  });
  if (code !== 0) failed.push(spec);
}

server.kill();
console.log(
  failed.length
    ? `\n${failed.length} of ${specs.length} spec files failed: ${failed.join(", ")}`
    : `\nAll ${specs.length} spec files passed.`,
);
console.log("Screenshots: e2e/screenshots/. The local Supabase stack is still running (npx supabase stop).");
process.exit(failed.length ? 1 : 0);
