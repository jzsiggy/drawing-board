// Step 1 -> 2: "Turning your sketch into a poster", then the poster with its
// e-ink preview and the title the model gave it, Try again, Edit sketch, and
// changing the title.
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
await makePoster(page);

// The fake generator's titles.
const suggested = /^(Harbour at Dusk|Summer Express|The Red Hills|Night Garden)$/;

// Step 1: generating, straight from the canvas.
const firstResult = page.url();
check("Make it a poster starts the poster straight away", firstResult.includes("/result/"));
check("…with no title to type", (await visible(page.getByLabel("Poster title")).count()) === 0);
// The loading skeleton has the same heading, so wait for the real content.
check("generating shows the style", await appears(visible(page.getByText("Retro poster", { exact: true }))));
check("…as step 1 of 2", await visible(page.getByText("Step 1 of 2")).isVisible());
check("…the sketch", await visible(page.getByRole("img", { name: "Your sketch" })).isVisible());
check("…a progress bar", await visible(page.getByRole("progressbar", { name: "Generating poster" })).isVisible());
check("…and the steps, with painting under way", (await visible(page.locator('[aria-current="step"]')).innerText()) === "Painting the poster");
await screenshot(page, "posters-1-generating");

// Step 2: the poster, without tapping anything, titled by the model.
await poster().waitFor({ timeout: 30000 });
check("the poster appears by itself when it's ready", true);
check("…with a title from the model", await appears(heading(suggested)));
const aiTitle = await visible(page.getByRole("heading", { level: 1 })).textContent();
check("…as step 2 of 2", await visible(page.getByText("Step 2 of 2")).isVisible());
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
check("Try again makes a new version with the same title", await appears(heading(aiTitle)));

await page.goBack();
await page.waitForURL(firstResult);
check("going back shows the first poster", await appears(poster()));
check("Try again isn't stuck on 'Starting…'", await visible(page.getByRole("button", { name: "Try again" })).isEnabled());

// Edit sketch: the strokes come back, and the new drawing gets its own title.
await visible(page.getByRole("link", { name: "Edit sketch" })).click();
await page.waitForURL("**/draw?from=**");
await canvas.waitFor();
check("Edit sketch reopens your strokes", await make().isEnabled());
await page.getByRole("radio", { name: "Blue" }).click();
await stroke(page, canvas, [[0.15, 0.15], [0.85, 0.15]]);
await makePoster(page);
await poster().waitFor({ timeout: 30000 });
check("the edited sketch becomes a poster too", true);
check("…titled by the model", await appears(heading(suggested)));

// Cancel while it's being made; the poster still gets its title.
await page.goto(page.url().replace(/\/result\/.*/, "/draw"));
await stroke(page, canvas, [[0.3, 0.3], [0.7, 0.7]]);
await makePoster(page);
await visible(page.getByRole("link", { name: "Cancel" })).click();
await page.waitForURL("**/draw");
await canvas.waitFor();
check("Cancel goes back to a blank canvas", await make().isDisabled());
await page.goBack();
await poster().waitFor({ timeout: 30000 });
check("a poster made after Cancel is titled too", await appears(heading(suggested)));

// Change it.
await visible(page.getByRole("button", { name: "Edit title" })).click();
const editField = visible(page.getByLabel("Poster title"));
check("Edit shows the suggested title in a field", suggested.test(await editField.inputValue()));
await editField.fill("My own name");
await screenshot(page, "posters-3-edit-title");
await visible(page.getByRole("button", { name: "Save title" })).click();
check("a saved title replaces the suggested one", await appears(heading("My own name")));
check("the page doesn't scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await page.reload();
check("the new title is saved", await appears(heading("My own name")));

// Cancel keeps the title; a blank one is "Untitled".
await visible(page.getByRole("button", { name: "Edit title" })).click();
await visible(page.getByLabel("Poster title")).fill("Not this");
await visible(page.getByRole("button", { name: "Cancel" })).click();
check("Cancel keeps the title", await heading("My own name").isVisible());
await visible(page.getByRole("button", { name: "Edit title" })).click();
await visible(page.getByLabel("Poster title")).fill("");
await visible(page.getByRole("button", { name: "Save title" })).click();
check("a cleared title is called Untitled", await appears(heading("Untitled")));

// Another version of a named drawing keeps its title, not a new suggestion.
await visible(page.getByRole("button", { name: "Edit title" })).click();
await visible(page.getByLabel("Poster title")).fill("Kept name");
await visible(page.getByRole("button", { name: "Save title" })).click();
await appears(heading("Kept name"));
const namedResult = page.url();
await visible(page.getByRole("button", { name: "Try again" })).click();
await page.waitForURL((url) => url.href.includes("/result/") && url.href !== namedResult);
await poster().waitFor({ timeout: 30000 });
check("another version keeps a title someone chose", await heading("Kept name").isVisible());

await finish();
