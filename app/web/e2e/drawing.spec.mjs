// The canvas: inks, tools, undo/redo/clear, layout on a phone, a fresh
// canvas every time you come back, and step 1 (the poster's title).
import { addYourself, BASE, check, launch, runId, screenshot, stroke } from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
await addYourself(page, `Drawer ${runId}`);

const canvas = page.getByRole("img", { name: "Drawing canvas" });
const button = (name) => page.getByRole("button", { name, exact: true }).filter({ visible: true });
const radio = (name) => page.getByRole("radio", { name });
const make = () => button("Make it a poster");

// Every control fits on a 390 px wide screen, above the bottom nav.
const viewport = page.viewportSize();
const nav = await page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).boundingBox();
for (const name of ["Make it a poster", "Fine pen", "Thick marker", "Eraser", "Undo", "Redo", "Clear canvas"]) {
  const box = await button(name).boundingBox();
  check(`"${name}" is fully on screen`, box && box.x >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= nav.y);
}
for (const name of ["Black", "White", "Red", "Yellow", "Blue", "Green"]) {
  const box = await radio(name).boundingBox();
  check(`"${name}" is fully on screen`, box && box.x >= 0 && box.x + box.width <= viewport.width);
}
check("the page doesn't scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
check(
  "the bottom nav marks Draw as the current tab",
  (await page.getByRole("link", { name: "Draw" }).filter({ visible: true }).getAttribute("aria-current")) === "page",
);
check("the bar says who's drawing, with their signature", await page.getByRole("img", { name: `Drawer ${runId}'s signature` }).isVisible());

check("'Make it a poster' is disabled on a blank canvas", await make().isDisabled());
await stroke(page, canvas, [[0.2, 0.8], [0.5, 0.2], [0.8, 0.8]]);
check("drawing enables 'Make it a poster' and Undo", (await make().isEnabled()) && (await button("Undo").isEnabled()));

await radio("Red").click();
await button("Thick marker").click();
check("picking an ink selects it", (await radio("Red").getAttribute("aria-checked")) === "true");
check("picking the marker selects it", (await button("Thick marker").getAttribute("aria-pressed")) === "true");
await stroke(page, canvas, [[0.5, 0.5], [0.5, 0.7]]);
await button("Eraser").click();
check("the eraser turns on", (await button("Eraser").getAttribute("aria-pressed")) === "true");
await stroke(page, canvas, [[0.4, 0.6], [0.6, 0.6]]);
await radio("Blue").click();
check("picking an ink while erasing goes back to the marker", (await button("Thick marker").getAttribute("aria-pressed")) === "true");
await screenshot(page, "drawing-1-tools");

await button("Undo").click();
await button("Undo").click();
await button("Undo").click();
check("undo goes back stroke by stroke", await button("Redo").isEnabled());
await button("Redo").click();
check("redo brings strokes back", await make().isEnabled());

await button("Clear canvas").click();
check("clearing asks first", await button("Keep drawing").isVisible());
await button("Keep drawing").click();
check("'Keep drawing' keeps the drawing", await make().isEnabled());
await button("Clear canvas").click();
await button("Clear").click();
check("clearing empties the canvas", await make().isDisabled());
await button("Undo").click();
check("clearing can be undone", await make().isEnabled());

// Leaving and coming back always shows a blank canvas.
await page.getByRole("link", { name: "Change" }).click();
await page.waitForURL("**/who");
await page.getByRole("button", { name: new RegExp(`Drawer ${runId}`) }).first().click();
await page.waitForURL("**/draw");
await canvas.waitFor();
check("the canvas is blank after Change and back", await make().isDisabled());

await stroke(page, canvas, [[0.3, 0.3], [0.6, 0.6]]);
await page.getByRole("link", { name: "Change" }).click();
await page.waitForURL("**/who");
await page.goBack();
await page.waitForURL("**/draw");
await canvas.waitFor();
check("the canvas is blank after the browser's Back", await make().isDisabled());
check("the ink resets to black", (await radio("Black").getAttribute("aria-checked")) === "true");
check("the tool resets to the fine pen", (await button("Fine pen").getAttribute("aria-pressed")) === "true");

// Step 1: the title.
await stroke(page, canvas, [[0.3, 0.3], [0.6, 0.6], [0.3, 0.7]]);
await make().click();
await page.waitForURL("**/draw/*/poster");
const step1 = page.url();
const title = page.getByLabel("Poster title").filter({ visible: true });
await page.waitForFunction((el) => !el.disabled, await title.elementHandle());
check("step 1 shows the sketch", await page.getByRole("img", { name: "Your sketch" }).isVisible());
check("step 1 says which step it is", await page.getByText("Step 1 of 3").filter({ visible: true }).isVisible());
await title.fill("Left behind");
await screenshot(page, "drawing-2-title");
await page.getByRole("link", { name: "Sketch" }).click();
await page.waitForURL("**/draw?from=**");
await canvas.waitFor();
check("'Sketch' goes back to the drawing, strokes kept", await make().isEnabled());
await page.goto(step1);
await page.waitForFunction((el) => !el.disabled, await title.elementHandle());
check("the title field starts empty again", (await title.inputValue()) === "");

await title.fill("x".repeat(70));
check("titles stop at 60 characters", (await title.inputValue()).length === 60);

const missing = await page.goto(BASE + "/draw/00000000-0000-0000-0000-000000000000/poster");
await page.getByText("This page could not be found").waitFor({ timeout: 10000 }).catch(() => {});
check("step 1 for a drawing that doesn't exist says so", missing && (await page.getByText("This page could not be found").isVisible()));

await finish();
