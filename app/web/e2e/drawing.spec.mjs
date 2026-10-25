// The canvas: tools, undo/redo/start over, layout on a phone, and a fresh
// canvas every time you come back.
import { addYourself, check, launch, runId, screenshot, stroke } from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
await addYourself(page, `Drawer ${runId}`);

const canvas = page.getByRole("img", { name: "Drawing canvas" });
const button = (name) => page.getByRole("button", { name });
const radio = (name) => page.getByRole("radio", { name });

// Every control fits on a 390 px wide screen.
const viewport = page.viewportSize();
for (const name of ["Submit", "Eraser", "Undo", "Redo", "Start over"]) {
  const box = await button(name).boundingBox();
  check(`"${name}" is fully on screen`, box && box.x >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height);
}
for (const name of ["Black", "Pink", "Thin", "Thick"]) {
  const box = await radio(name).boundingBox();
  check(`"${name}" is fully on screen`, box && box.x >= 0 && box.x + box.width <= viewport.width);
}

check("Submit is disabled on a blank canvas", await button("Submit").isDisabled());
await stroke(page, canvas, [[0.2, 0.8], [0.5, 0.2], [0.8, 0.8]]);
check("drawing enables Submit and Undo", (await button("Submit").isEnabled()) && (await button("Undo").isEnabled()));

await radio("Red").click();
await radio("Thick").click();
check("picking a colour selects it", (await radio("Red").getAttribute("aria-checked")) === "true");
check("picking a size selects it", (await radio("Thick").getAttribute("aria-checked")) === "true");
await stroke(page, canvas, [[0.5, 0.5], [0.5, 0.7]]);
await button("Eraser").click();
check("the eraser toggles on", (await button("Eraser").getAttribute("aria-pressed")) === "true");
await stroke(page, canvas, [[0.4, 0.6], [0.6, 0.6]]);
await radio("Blue").click();
check("picking a colour turns the eraser off", (await button("Eraser").getAttribute("aria-pressed")) === "false");
await screenshot(page, "drawing-1-tools");

await button("Undo").click();
await button("Undo").click();
await button("Undo").click();
check("undo goes back stroke by stroke", await button("Redo").isEnabled());
await button("Redo").click();
check("redo brings strokes back", await button("Submit").isEnabled());

await button("Start over").click();
check("start over asks first", await button("Keep drawing").isVisible());
await button("Keep drawing").click();
check("'Keep drawing' keeps the drawing", await button("Submit").isEnabled());
await button("Start over").click();
await page.getByRole("button", { name: "Start over" }).last().click();
check("start over clears the canvas", await button("Submit").isDisabled());
await button("Undo").click();
check("start over can be undone", await button("Submit").isEnabled());

// Leaving and coming back always shows a blank canvas.
await page.getByRole("link", { name: "Switch" }).click();
await page.waitForURL("**/who");
await page.getByRole("button", { name: new RegExp(`Drawer ${runId}`) }).first().click();
await page.waitForURL("**/draw");
await canvas.waitFor();
check("the canvas is blank after Switch and back", await button("Submit").isDisabled());

await stroke(page, canvas, [[0.3, 0.3], [0.6, 0.6]]);
await page.getByRole("link", { name: "Switch" }).click();
await page.waitForURL("**/who");
await page.goBack();
await page.waitForURL("**/draw");
await canvas.waitFor();
check("the canvas is blank after the browser's Back", await button("Submit").isDisabled());
check("the colour resets to black", (await radio("Black").getAttribute("aria-checked")) === "true");

await finish();
