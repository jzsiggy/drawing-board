// The canvas: inks, tools, undo/redo/clear, layout on a phone, a fresh
// canvas every time you come back, and Make it a poster.
import { addYourself, check, launch, runId, screenshot, stroke } from "./lib.mjs";

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

// Make it a poster: straight to the poster being made, no title to type.
await stroke(page, canvas, [[0.3, 0.3], [0.6, 0.6], [0.3, 0.7]]);
await make().click();
await page.waitForURL("**/result/**");
check("Make it a poster opens the poster being made", true);
check("…without asking for a title", (await page.getByLabel("Poster title").filter({ visible: true }).count()) === 0);
await screenshot(page, "drawing-2-generating");

await finish();
