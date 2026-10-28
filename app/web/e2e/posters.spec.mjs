// Step 1 -> 2 -> 3: title, "Turning your sketch into a poster", the poster
// with its e-ink preview, Try again and Edit sketch.
// Runs with IMAGE_GENERATOR=fake, so no API credits are spent.
import { addYourself, appears, check, launch, makePoster, runId, screenshot, stroke } from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
const artist = `Poster ${runId}`;
await addYourself(page, artist);

const canvas = page.getByRole("img", { name: "Drawing canvas" });
const visible = (locator) => locator.filter({ visible: true });
const poster = () => visible(page.getByRole("img", { name: /Retro poster made from/ }));
const heading = (name) => visible(page.getByRole("heading", { name }));
const make = () => visible(page.getByRole("button", { name: "Make it a poster" }));

async function loaded(img) {
  await img.waitFor();
  return img.evaluate((el) => new Promise((resolve) => (el.complete ? resolve(el.naturalWidth > 0) : (el.onload = () => resolve(el.naturalWidth > 0), el.onerror = () => resolve(false)))));
}

await page.getByRole("button", { name: "Thick marker" }).click();
await stroke(page, canvas, [[0.2, 0.8], [0.5, 0.2], [0.8, 0.8], [0.2, 0.8]]);
await page.getByRole("radio", { name: "Red" }).click();
await stroke(page, canvas, [[0.5, 0.45], [0.5, 0.7]]);
await makePoster(page, "Sunday hills");

// Step 2: generating.
const firstResult = page.url();
// The loading skeleton has the same heading, so wait for the real content.
check("generating shows the title and style", await appears(visible(page.getByText("Sunday hills · Retro poster"))));
check("…the sketch", await visible(page.getByRole("img", { name: "Your sketch" })).isVisible());
check("…a progress bar", await visible(page.getByRole("progressbar", { name: "Generating poster" })).isVisible());
check("…and the steps, with painting under way", (await visible(page.locator('[aria-current="step"]')).innerText()) === "Painting the poster");
await screenshot(page, "posters-1-generating");

// Step 3: the poster, without tapping anything.
await poster().waitFor({ timeout: 30000 });
check("the poster appears by itself when it's ready", await heading("Sunday hills").isVisible());
check("…as step 3 of 3", await visible(page.getByText("Step 3 of 3")).isVisible());
check("…credited to the artist", await visible(page.getByText(`Retro poster · by ${artist}`)).isVisible());
check("the generated poster loads", await loaded(poster()));
await screenshot(page, "posters-2-poster");

await visible(page.getByRole("radio", { name: "On e-ink" })).click();
const eink = visible(page.getByRole("img", { name: /as the e-ink display will show it/ }));
check("'On e-ink' shows the dithered preview", await loaded(eink));
check("…with a caption saying so", await visible(page.getByText("Dithered to the six inks, as the display will show it.")).isVisible());
await screenshot(page, "posters-3-eink");
await visible(page.getByRole("radio", { name: "Generated" })).click();
check("'Generated' goes back to the poster", await poster().isVisible());

// Try again: a new version with the same title.
await visible(page.getByRole("button", { name: "Try again" })).click();
await page.waitForURL((url) => url.href.includes("/result/") && url.href !== firstResult);
await poster().waitFor({ timeout: 30000 });
check("Try again makes a new version with the same title", await heading("Sunday hills").isVisible());

await page.goBack();
await page.waitForURL(firstResult);
check("going back shows the first poster", await appears(poster()));
check("Try again isn't stuck on 'Starting…'", await visible(page.getByRole("button", { name: "Try again" })).isEnabled());

// Edit sketch: the strokes come back, and step 1 suggests the same title.
await visible(page.getByRole("link", { name: "Edit sketch" })).click();
await page.waitForURL("**/draw?from=**");
await canvas.waitFor();
check("Edit sketch reopens your strokes", await make().isEnabled());
await page.getByRole("radio", { name: "Blue" }).click();
await stroke(page, canvas, [[0.15, 0.15], [0.85, 0.15]]);
await make().click();
await page.waitForURL("**/draw/*/poster");
const titleField = visible(page.getByLabel("Poster title"));
await page.waitForFunction((el) => !el.disabled, await titleField.elementHandle());
check("an edited sketch keeps its title", (await titleField.inputValue()) === "Sunday hills");
await visible(page.getByRole("button", { name: "Generate poster" })).click();
await page.waitForURL("**/result/**");
await poster().waitFor({ timeout: 30000 });
check("the edited sketch becomes a poster too", true);

// No title: "Untitled". Cancel while it's being made.
await page.goto(page.url().replace(/\/result\/.*/, "/draw"));
await stroke(page, canvas, [[0.3, 0.3], [0.7, 0.7]]);
await makePoster(page, "");
await visible(page.getByRole("link", { name: "Cancel" })).click();
await page.waitForURL("**/draw");
await canvas.waitFor();
check("Cancel goes back to a blank canvas", await make().isDisabled());
await page.goBack();
await poster().waitFor({ timeout: 30000 });
check("a poster without a title is called Untitled", await heading("Untitled").isVisible());

await finish();
