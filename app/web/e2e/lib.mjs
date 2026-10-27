// Shared helpers for the browser tests. Each spec is a plain Node script run
// by e2e/run.mjs; it prints PASS/FAIL lines and exits non-zero on failure.
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3101";
export const BOARD_TOKEN = process.env.E2E_BOARD_TOKEN ?? "e2e-frame-token";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCREENSHOTS = new URL("./screenshots/", import.meta.url).pathname;

const failures = [];

export function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
}

// A fresh browser per spec; each call to newPhone() is a different phone
// (new cookies, so a new device).
export async function launch() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const pageErrors = [];

  async function newPhone() {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => m.type() === "error" && pageErrors.push(m.text().slice(0, 300)));
    return page;
  }

  async function finish() {
    await browser.close();
    check("no errors in the browser console", pageErrors.length === 0);
    for (const e of pageErrors) console.log(`      ${e}`);
    if (failures.length) process.exitCode = 1;
  }

  return { newPhone, finish };
}

// Draws one stroke through points given as fractions of the canvas, like a
// finger: only once the canvas is on screen and has a size.
export async function stroke(page, canvas, points) {
  await canvas.waitFor();
  await page.waitForFunction((el) => el.getBoundingClientRect().width > 10, await canvas.elementHandle());
  const box = await canvas.boundingBox();
  const at = ([x, y]) => [box.x + x * box.width, box.y + y * box.height];
  await page.mouse.move(...at(points[0]));
  await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(...at(p), { steps: 8 });
  await page.mouse.up();
}

// caret: "initial" stops Playwright injecting a style into inputs, which
// React reports as a hydration mismatch if it lands mid-hydration.
export async function screenshot(page, name) {
  mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: SCREENSHOTS + name + ".png", caret: "initial" });
}

// Adds a person through the "Add yourself" form and lands on the canvas.
export async function addYourself(page, name) {
  await page.goto(BASE + "/who/new");
  await page.getByPlaceholder("Whatever you like to be called").fill(name);
  await stroke(page, page.getByRole("img", { name: "Signature pad" }), [
    [0.1, 0.6],
    [0.3, 0.3],
    [0.5, 0.7],
    [0.9, 0.4],
  ]);
  await page.getByRole("button", { name: "Start drawing" }).click();
  await page.waitForURL("**/draw");
  await page.getByRole("img", { name: "Drawing canvas" }).waitFor();
}

// Unique per run, so specs don't trip over people from earlier runs.
export const runId = Date.now().toString(36).slice(-5);

// Plays the frame's part of app/docs/frame-protocol.md like the firmware:
// check in with the hash it's showing, download and verify a new image, ack.
let frameShowing = null;
export async function frameChecksIn() {
  const headers = { Authorization: `Bearer ${BOARD_TOKEN}`, "X-Battery-mV": "3950", "X-RSSI": "-55", "X-Firmware": "e2e" };
  const state = await fetch(BASE + "/api/frame/state", {
    headers: frameShowing ? { ...headers, "If-None-Match": `"${frameShowing}"` } : headers,
  });
  const nextCheck = state.headers.get("x-next-check");
  if (state.status === 204) return { changed: false, nextCheck };
  if (state.status !== 200) throw new Error(`frame state returned ${state.status}`);
  const { sha256, url, bytes } = await state.json();
  const file = Buffer.from(await (await fetch(url)).arrayBuffer());
  const valid =
    file.length === bytes &&
    file.subarray(0, 4).toString("ascii") === "EPD1" &&
    createHash("sha256").update(file).digest("hex") === sha256;
  const ack = await fetch(BASE + "/api/frame/ack", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ sha256 }),
  });
  if (valid) frameShowing = sha256;
  return { changed: true, valid, acked: ack.status === 204, nextCheck };
}

// For things that load after the page (fetches, streamed content): waits up
// to `timeout` instead of checking once. isVisible() doesn't wait.
export function appears(locator, timeout = 10000) {
  return locator.waitFor({ timeout }).then(() => true, () => false);
}

// Inserts rows straight into the local test database, for states the UI
// can't easily produce (a failed or abandoned poster).
export async function insertRows(table, rows) {
  const response = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: process.env.E2E_SUPABASE_SECRET,
      Authorization: `Bearer ${process.env.E2E_SUPABASE_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`insert into ${table} returned ${response.status}: ${await response.text()}`);
}
