// npm run e2e: start the local Supabase stack, reset its database and add a
// test frame, build and start the app against it with fake posters, run
// every e2e/*.spec.mjs in a phone-sized Chrome, and report. Never touches
// the real Supabase project.
//
// Options: --no-build (reuse the last build), --only people (one spec).
// Needs Docker running and Google Chrome installed (or CHROME_PATH).

import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
// The test frame's bearer token, so specs can play the frame's part.
const BOARD_TOKEN = "e2e-frame-token";
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const run = (cmd, cmdArgs, env) => execFileSync(cmd, cmdArgs, { cwd: ROOT, env, encoding: "utf8" });

console.log("Starting local Supabase…");
run("npx", ["supabase", "start", "-x", "studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta"]);
const status = JSON.parse(run("npx", ["supabase", "status", "-o", "json"]));
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(status.API_URL)) {
  throw new Error(`Refusing to reset a non-local database: ${status.API_URL}`);
}

console.log("Resetting the local database…");
run("npx", ["supabase", "db", "reset", "--local"]);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error: boardError } = await admin
  .from("boards")
  .insert({ name: "Test frame", token_hash: createHash("sha256").update(BOARD_TOKEN).digest("hex") });
if (boardError) throw boardError;

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
      env: {
        ...process.env,
        E2E_BASE_URL: BASE,
        E2E_BOARD_TOKEN: BOARD_TOKEN,
        E2E_SUPABASE_URL: status.API_URL,
        E2E_SUPABASE_SECRET: status.SERVICE_ROLE_KEY,
      },
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
