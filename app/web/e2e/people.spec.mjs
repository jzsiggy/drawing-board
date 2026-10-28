// "Who's drawing?": adding yourself, the picker, and who may edit whom.
import { addYourself, BASE, check, launch, runId, screenshot, stroke } from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
const name = `Ana ${runId}`;

await page.goto(BASE + "/");
await page.waitForURL("**/who");
await page.getByRole("link", { name: "Add a person" }).waitFor();
check("first visit opens the picker", true);
await screenshot(page, "people-1-picker");

// A signature stroke that slides off the pad is still saved.
await page.goto(BASE + "/who/new");
await page.getByPlaceholder("Whatever you like to be called").fill(name);
await stroke(page, page.getByRole("img", { name: "Signature pad" }), [[0.2, 0.5], [0.7, 0.6], [1.3, 1.6]]);
await screenshot(page, "people-4-new-person");
await page.getByRole("button", { name: "Save person" }).click();
await page.waitForURL("**/draw", { timeout: 10000 }).catch(() => {});
check("a signature sliding off the pad is saved", page.url().endsWith("/draw"));
check("the canvas says who's drawing", await page.getByText(`Drawing as ${name}`).waitFor().then(() => true, () => false));

// The picker: you, under "On this phone", with Edit.
await page.getByRole("link", { name: "Switch" }).click();
await page.waitForURL("**/who");
await page.getByText("On this phone").waitFor();
const card = page.getByRole("button", { name: new RegExp(name) });
check("you appear in the picker", await card.first().isVisible());
const editHref = await page.getByRole("link", { name: `Edit ${name}` }).getAttribute("href");
check("people you added have an Edit link", Boolean(editHref));
check("your row shows your poster count", await card.first().getByText("No posters yet").isVisible());
await screenshot(page, "people-2-picker-with-you");

await page.getByPlaceholder("Search names").fill(runId);
check("search finds you", await card.first().isVisible());
await page.getByPlaceholder("Search names").fill("zzz-nobody");
check("search hides non-matches", (await card.count()) === 0);
await page.getByPlaceholder("Search names").fill(runId);

// Picking someone, then coming back, shows nothing stuck or left over.
await card.first().click();
await page.waitForURL("**/draw");
await page.getByRole("link", { name: "Switch" }).click();
await page.waitForURL("**/who");
await page.getByRole("link", { name: "Add a person" }).waitFor();
check("no card is stuck on 'One moment…'", (await page.getByText("One moment…").count()) === 0);
check("the person you picked says 'drawing now'", await page.getByText("No posters yet · drawing now").filter({ visible: true }).isVisible());
const peopleTab = page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: "People" });
check("the bottom nav marks People as the current tab", (await peopleTab.getAttribute("aria-current")) === "page");
check("search is cleared after leaving", (await page.getByPlaceholder("Search names").inputValue()) === "");

// The add form starts empty after leaving it half-filled...
await page.getByRole("link", { name: "Add a person" }).click();
await page.waitForURL("**/who/new");
await page.getByPlaceholder("Whatever you like to be called").fill("Leftover");
await stroke(page, page.getByRole("img", { name: "Signature pad" }), [[0.2, 0.5], [0.8, 0.5]]);
await page.getByRole("link", { name: "People" }).first().click();
await page.waitForURL("**/who");
await page.getByRole("link", { name: "Add a person" }).click();
await page.waitForURL("**/who/new");
check("the add form is empty when you come back", (await page.getByPlaceholder("Whatever you like to be called").inputValue()) === "");
check("the signature is cleared when you come back", await page.getByRole("button", { name: "Save person" }).isDisabled());

// ...and after adding someone.
await addYourself(page, `Ben ${runId}`);
await page.getByRole("link", { name: "Switch" }).click();
await page.waitForURL("**/who");
await page.getByRole("link", { name: "Add a person" }).click();
await page.waitForURL("**/who/new");
check("the add form is empty after adding someone", (await page.getByPlaceholder("Whatever you like to be called").inputValue()) === "");

// Another phone can pick Ana but not edit her.
const other = await newPhone();
await other.goto(BASE + "/who");
await other.getByText("On this phone").or(other.getByText("Everyone")).first().waitFor();
check("another phone doesn't see Ana under 'On this phone'", (await other.getByText("On this phone").count()) === 0);
// The page streams, so the status is already 200 when it finds out; check
// what the phone sees instead.
await other.goto(BASE + editHref);
await other.getByText("This page could not be found").waitFor({ timeout: 10000 }).catch(() => {});
await screenshot(other, "people-3-edit-from-other-phone");
check("another phone can't open Ana's edit page", await other.getByText("This page could not be found").isVisible());
check("…and sees no edit form", (await other.getByPlaceholder("Whatever you like to be called").count()) === 0);
await other.goto(BASE + "/who");
await other.getByRole("button", { name: new RegExp(name) }).first().click();
await other.waitForURL("**/draw");
check("another phone can pick Ana", await other.getByText(`Drawing as ${name}`).waitFor().then(() => true, () => false));

await finish();
