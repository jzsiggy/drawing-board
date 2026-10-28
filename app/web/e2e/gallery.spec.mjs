// The gallery, poster first: the "on display now" card, one card per drawing
// with its version count, filters, and a poster's page (details, versions,
// Show on display).
import {
  addYourself,
  appears,
  BASE,
  check,
  frameChecksIn,
  insertRows,
  launch,
  makePoster,
  runId,
  screenshot,
  selectRows,
  stroke,
} from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
const name = `Gal ${runId}`;
await addYourself(page, name);

// Visited pages stay in the DOM, hidden, so match visible elements only.
const visible = (locator) => locator.filter({ visible: true });
const text = (t) => visible(page.getByText(t));
const heading = (t) => visible(page.getByRole("heading", { name: t }));
const poster = () => visible(page.getByRole("img", { name: /Retro poster made from/ }));
// Grid cards, not the "on display now" card (whose name starts the same).
const card = (title) => visible(page.getByRole("link", { name: new RegExp(`^${title}(?!, on the display now)`) }));
const first = `Sunday hills ${runId}`;
const second = `Red wedge ${runId}`;

async function allImagesLoaded(locator) {
  const images = await visible(locator).all();
  for (const img of images) {
    await img.scrollIntoViewIfNeeded();
    const ok = await img.evaluate(
      (el) => new Promise((resolve) => (el.complete ? resolve(el.naturalWidth > 0) : (el.onload = () => resolve(el.naturalWidth > 0), el.onerror = () => resolve(false)))),
    );
    if (!ok) return false;
  }
  return images.length > 0;
}

async function newPoster(title) {
  await page.goto(BASE + "/draw");
  await stroke(page, page.getByRole("img", { name: "Drawing canvas" }), [[0.2, 0.8], [0.5, 0.2], [0.8, 0.8]]);
  await makePoster(page, title);
  await poster().waitFor({ timeout: 30000 });
  return page.url().split("/result/")[1];
}

async function sendAndShow(sendButton) {
  await page.waitForFunction((el) => !el.disabled, await sendButton.elementHandle());
  await sendButton.click();
  await page.waitForURL("**/sent");
  const pickup = await frameChecksIn();
  await heading("On the display").waitFor({ timeout: 15000 });
  return pickup;
}

async function openGallery(filter = "") {
  await page.goto(BASE + "/gallery" + filter);
  await visible(page.getByText(/^\d+ posters?$/)).waitFor();
}

// One poster on the display, one not.
const firstId = await newPoster(first);
await sendAndShow(visible(page.getByRole("button", { name: "Send to display" })));
const secondId = await newPoster(second);

await openGallery();
const featured = visible(page.getByRole("link", { name: new RegExp(`${first}, on the display now`) }));
check("the poster on the display gets the 'On display now' card", await featured.isVisible());
check("…saying since when", await featured.getByText(/since \d{1,2}:\d\d( [AP]M)? today/).isVisible());
check("…and isn't repeated in the grid", (await card(first).count()) === 0);
check("the other poster is in the grid", await card(second).isVisible());
check("…with its artist", await card(second).getByText(new RegExp(`^${name} · `)).isVisible());
check("Gallery is the current tab", (await visible(page.getByRole("link", { name: "Gallery" })).getAttribute("aria-current")) === "page");
check("the gallery's images load", await allImagesLoaded(page.getByRole("img", { name: new RegExp(`${first}|${second}`) })));
check("the page doesn't scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await screenshot(page, "gallery-1-grid");
await openGallery("?filter=mine");
check("the count says 2 posters", await text("2 posters").isVisible());

// A poster's page.
await card(second).click();
await page.waitForURL(`**/gallery/${secondId}`);
await heading(second).waitFor();
check("a card opens the poster's page", true);
check("…with the artist", await text(`by ${name}`).isVisible());
check("…its style", await text("Retro poster").isVisible());
check("…never shown yet", await text("Not yet").isVisible());
check("…and its images load", await allImagesLoaded(page.getByRole("img", { name: /by Gal|The original sketch/ })));
check("one version: no version strip", (await text(/^Version \d of/).count()) === 0);

// Another version: one card, "2 versions".
await visible(page.getByRole("button", { name: "Another version" })).click();
await page.waitForURL("**/result/**");
await poster().waitFor({ timeout: 30000 });
const secondV2 = page.url().split("/result/")[1];
check("another version keeps the title", await heading(second).isVisible());

// Failed and abandoned attempts aren't versions.
const [{ drawing_id: drawingId }] = await selectRows("generations", `id=eq.${secondId}&select=drawing_id`);
const attempt = { drawing_id: drawingId, preset_id: "e2e", preset_version: 1, prompt: "e2e", model: "e2e" };
await insertRows("generations", [
  { ...attempt, status: "failed", created_at: new Date().toISOString() },
  { ...attempt, status: "running", created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
]);

await openGallery();
check("two versions of one drawing make one card", (await card(second).count()) === 1);
check("…tagged '2 versions'", await card(second).getByText("2 versions").isVisible());
check("…showing the newest version", (await card(second).getAttribute("href")) === `/gallery/${secondV2}`);
// Other specs' posters are in "All"; count this artist's under "Mine".
await openGallery("?filter=mine");
check("the count says 3 posters (failed attempts don't count)", await text("3 posters").isVisible());
await openGallery();

// The version strip.
await card(second).click();
await page.waitForURL(`**/gallery/${secondV2}`);
check("the poster page shows 'Version 2 of 2'", await appears(text("Version 2 of 2")));
await visible(page.getByRole("link", { name: "Version 1" })).click();
await page.waitForURL(`**/gallery/${secondId}`);
check("tapping a version opens it", await appears(text("Version 1 of 2")));
await screenshot(page, "gallery-2-poster");

// Show on display from the poster page: it takes over the featured card.
const pickup = await sendAndShow(visible(page.getByRole("button", { name: "Show on display" })));
check("the frame picks up the poster sent from the gallery", pickup.changed && pickup.valid);
await openGallery();
check(
  "the newly shown poster is now 'On display now'",
  await visible(page.getByRole("link", { name: new RegExp(`${second}, on the display now`) })).isVisible(),
);
check("the earlier one is back in the grid", await card(first).isVisible());
await page.goto(BASE + `/gallery/${firstId}`);
check("the earlier poster's page says when it was last shown", await appears(text(/^\d{1,2}:\d\d( [AP]M)? today$/)));

for (const [label, filter] of [["Shown on display", "shown"], ["Mine", "mine"], ["All", ""]]) {
  await openGallery(filter ? `?filter=${filter}` : "");
  check(`"${label}" is marked as the current filter`, (await visible(page.getByRole("link", { name: label, exact: true })).getAttribute("aria-current")) === "page");
  check(`"${label}" includes the earlier poster`, await card(first).isVisible());
}
await openGallery("?filter=shown");
check("'Shown on display' features the version that was shown", (await card(first).getAttribute("href")) === `/gallery/${firstId}`);

// Suggested and cleared titles, and old links that named a drawing.
const untitled = await newPoster();
await page.goto(BASE + `/gallery/${untitled}`);
const suggested = await visible(page.getByRole("heading", { level: 1 })).textContent();
check("a suggested title shows on the poster's page", /^(Harbour at Dusk|Summer Express|The Red Hills|Night Garden)$/.test(suggested));
const [{ drawing_id: untitledDrawing }] = await selectRows("generations", `id=eq.${untitled}&select=drawing_id`);
await page.request.patch(BASE + `/api/drawings/${untitledDrawing}`, { data: { title: "" } });
await page.reload();
check("a poster without a title is called Untitled", await appears(heading("Untitled")));
await page.goto(BASE + `/gallery/${drawingId}`);
await page.waitForURL(`**/gallery/${secondId}`, { timeout: 10000 }).catch(() => {});
check("an old drawing link opens its featured poster", page.url().endsWith(`/gallery/${secondId}`));

// Another phone: Mine depends on who you are; All shows everything.
const other = await newPhone();
await other.goto(BASE + "/gallery?filter=mine");
await visible(other.getByText("to see your posters")).waitFor();
check("Mine asks a phone with no person to pick who they are", true);
await addYourself(other, `Other ${runId}`);
await other.goto(BASE + "/gallery?filter=mine");
await visible(other.getByText("You haven't made a poster yet.")).waitFor();
check("Mine is empty for someone who hasn't made a poster", true);
await other.goto(BASE + "/gallery");
check("All shows other people's posters", await appears(visible(other.getByRole("link", { name: new RegExp(`^${first}`) }))));

const noSession = await fetch(BASE + `/api/images/thumb/${firstId}`, { redirect: "manual" });
check("images need a session (no anonymous user is created for API calls)", noSession.status === 401);

await finish();
