// The gallery: drawings with their versions, the drawing page (pick a
// version, send it, make another), filters, and images loading.
import { addYourself, makePoster, appears, BASE, check, frameChecksIn, insertRows, launch, runId, screenshot, stroke } from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
const name = `Gal ${runId}`;
await addYourself(page, name);

// Visited pages stay in the DOM, hidden, so match visible elements only.
const visible = (locator) => locator.filter({ visible: true });
const text = (t) => visible(page.getByText(t));
const poster = () => visible(page.getByRole("img", { name: /Retro poster made from/ }));

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

// A poster, on the frame.
await stroke(page, page.getByRole("img", { name: "Drawing canvas" }), [[0.2, 0.8], [0.5, 0.2], [0.8, 0.8]]);
await makePoster(page);
await poster().waitFor({ timeout: 30000 });
const resultUrl = page.url();
await page.waitForFunction((el) => !el.disabled, await visible(page.getByRole("button", { name: "Send to display" })).elementHandle());
await visible(page.getByRole("button", { name: "Send to display" })).click();
await page.waitForURL("**/sent");
await frameChecksIn();
await visible(page.getByRole("heading", { name: "On the display" })).waitFor({ timeout: 15000 });
await page.goto(resultUrl);

// Its page in the gallery.
await visible(page.getByRole("link", { name: "Save to gallery without displaying" })).click();
await page.waitForURL("**/gallery/**");
const drawingUrl = page.url().split("?")[0];
await visible(page.getByRole("heading", { name: /^Version 1/ })).waitFor();
check("the poster page links to the drawing's gallery page", true);
check("the drawing page marks the version that's on the frame", await text("On the frame").first().isVisible());
check("the drawing page shows the frame status", await appears(text("On the frame now")));
check("the drawing and poster images load", await allImagesLoaded(page.getByRole("img", { name: /Drawing by|Poster version/ })));
await screenshot(page, "gallery-1-drawing-page");

// Failed and abandoned attempts aren't versions; the counts below ("2 of 2")
// also check they aren't numbered.
const attempt = { drawing_id: drawingUrl.split("/").pop(), preset_id: "e2e", preset_version: 1, prompt: "e2e", model: "e2e" };
await insertRows("generations", [
  { ...attempt, status: "failed", created_at: new Date().toISOString() },
  { ...attempt, status: "running", created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
]);
await page.reload();
await visible(page.getByRole("heading", { name: /^Version 1/ })).waitFor();
check(
  "failed and abandoned attempts don't show as versions",
  !(await text("Didn't work").count()) && !(await text("Printing…").count()) && !(await text(/of \d/).count()),
);

// Another version from the drawing page.
await visible(page.getByRole("button", { name: "Another version" })).click();
await page.waitForURL("**/result/**");
await poster().waitFor({ timeout: 30000 });
await visible(page.getByRole("link", { name: "Save to gallery without displaying" })).click();
await page.waitForURL("**/gallery/**");
await visible(page.getByRole("heading", { name: "Version 2 of 2" })).waitFor();
check("a new version appears and is selected", true);
check("…ready to send", await appears(visible(page.getByRole("button", { name: "Send to frame" }))));

await visible(page.getByRole("link", { name: /Poster version 1/ })).click();
await visible(page.getByRole("heading", { name: "Version 1 of 2" })).waitFor();
check("tapping a version selects it", await appears(text("On the frame now")));

await visible(page.getByRole("link", { name: /Poster version 2/ })).click();
await visible(page.getByRole("heading", { name: "Version 2 of 2" })).waitFor();
await visible(page.getByRole("button", { name: "Send to frame" })).click();
await text(/Sent\. It shows up/).waitFor({ timeout: 10000 });
const pickup = await frameChecksIn();
check("the frame picks up the version sent from the gallery", pickup.changed && pickup.valid);
await text("On the frame now").waitFor({ timeout: 15000 });
await page.reload();
await visible(page.getByRole("heading", { name: /^Version/ })).waitFor();
check("the older version now says it was on the frame", await text("Was on the frame").isVisible());
const selectedCard = visible(page.locator('[aria-label="Drawing and versions"] [aria-current="true"]'));
await page.waitForTimeout(300);
const box = await selectedCard.boundingBox();
const width = page.viewportSize().width;
check("the selected version is scrolled into view", box && box.x >= 0 && box.x + box.width <= width + 1);
await screenshot(page, "gallery-2-two-versions");

// The grid and its filters.
await page.goto(BASE + "/gallery");
const card = visible(page.getByRole("link", { name: new RegExp(`Drawing by ${name}`) }));
await card.waitFor();
check("the drawing is in the gallery", true);
check("its card says it's on the frame", await card.getByText("On the frame").isVisible());
check("its card shows both versions", (await card.getByRole("img", { name: /Poster version/ }).count()) === 2);
check("the gallery's images load", await allImagesLoaded(page.getByRole("img", { name: new RegExp(`Drawing by ${name}|Poster version`) })));
await screenshot(page, "gallery-3-grid");

for (const filter of ["Mine", "Been on the frame", "Everyone"]) {
  await visible(page.getByRole("link", { name: filter, exact: true })).click();
  await visible(page.getByRole("link", { name: filter, exact: true })).and(page.locator('[aria-current="page"]')).waitFor();
  check(`"${filter}" includes the drawing`, await appears(card));
}

await card.click();
await page.waitForURL(drawingUrl + "**");
check("a card opens the drawing's page", true);

// Leaving mid-"Another version" and coming back shows nothing stuck.
await visible(page.getByRole("button", { name: "Another version" })).click();
await page.waitForURL("**/result/**");
await page.goBack();
await visible(page.getByRole("heading", { name: /^Version/ })).waitFor();
check("'Another version' isn't stuck on 'Starting…'", await visible(page.getByRole("button", { name: "Another version" })).isEnabled());

// Another phone: Mine depends on who you are; Everyone shows it all.
const other = await newPhone();
await other.goto(BASE + "/gallery?filter=mine");
await visible(other.getByText("to see your drawings")).waitFor();
check("Mine asks a phone with no person to pick who they are", true);
await addYourself(other, `Other ${runId}`);
await other.goto(BASE + "/gallery?filter=mine");
await visible(other.getByText("You haven't drawn anything yet.")).waitFor();
check("Mine is empty for someone who hasn't drawn", true);
await other.goto(BASE + "/gallery");
check(
  "Everyone shows other people's drawings",
  await appears(visible(other.getByRole("link", { name: new RegExp(`Drawing by ${name}`) }))),
);

const noSession = await fetch(BASE + drawingUrl.replace(BASE, "").replace("/gallery/", "/api/images/sketch/"), { redirect: "manual" });
check("images need a session (no anonymous user is created for API calls)", noSession.status === 401);

await finish();
