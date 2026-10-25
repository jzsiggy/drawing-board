// Submit -> "Printing your poster…" -> poster, Try again, Keep drawing.
// Runs with IMAGE_GENERATOR=fake, so no API credits are spent.
import { addYourself, check, launch, runId, screenshot, stroke } from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
await addYourself(page, `Poster ${runId}`);

const canvas = page.getByRole("img", { name: "Drawing canvas" });
const poster = () => page.getByRole("img", { name: /Retro poster made from/ });

await page.getByRole("radio", { name: "Thick" }).click();
await stroke(page, canvas, [[0.2, 0.8], [0.5, 0.2], [0.8, 0.8], [0.2, 0.8]]);
await page.getByRole("radio", { name: "Red" }).click();
await stroke(page, canvas, [[0.5, 0.45], [0.5, 0.7]]);
await page.getByRole("button", { name: "Submit" }).click();

await page.waitForURL("**/result/**");
const firstResult = page.url();
check("Submit opens the poster page", true);
await page.getByRole("img", { name: "Your drawing" }).waitFor({ timeout: 15000 });
check("it shows 'Printing your poster…' over the sketch", await page.getByRole("heading", { name: "Printing your poster…" }).isVisible());
await screenshot(page, "posters-1-printing");

await poster().waitFor({ timeout: 30000 });
check("the poster appears when ready", await page.getByRole("heading", { name: "Your poster" }).isVisible());
await screenshot(page, "posters-2-poster");

await page.getByRole("button", { name: "Try again" }).click();
await page.waitForURL((url) => url.href.includes("/result/") && url.href !== firstResult);
check("Try again opens a new version", true);
await poster().waitFor({ timeout: 30000 });
check("the new version finishes", true);

await page.goBack();
await page.waitForURL(firstResult);
check("going back shows the first poster", await poster().isVisible());
check("Try again isn't stuck on 'Starting…'", await page.getByRole("button", { name: "Try again" }).isEnabled());

await page.getByRole("link", { name: "Keep drawing" }).click();
await page.waitForURL("**/draw?from=**");
await canvas.waitFor();
check("Keep drawing reopens your strokes", await page.getByRole("button", { name: "Submit" }).isEnabled());
await page.getByRole("radio", { name: "Blue" }).click();
await stroke(page, canvas, [[0.15, 0.15], [0.85, 0.15]]);
await page.getByRole("button", { name: "Submit" }).click();
await page.waitForURL("**/result/**");
await poster().waitFor({ timeout: 30000 });
check("the continued drawing becomes a poster too", true);

await page.getByRole("link", { name: "← New drawing" }).click();
await page.waitForURL("**/draw");
await canvas.waitFor();
check("New drawing opens a blank canvas", await page.getByRole("button", { name: "Submit" }).isDisabled());

await finish();
