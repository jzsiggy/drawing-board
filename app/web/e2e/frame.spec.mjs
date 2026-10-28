// "Send to display" and the "On the display" screen, with this script
// playing the frame (check in, download, ack) against the test frame that
// run.mjs creates. Also the header's "Display online".
import { addYourself, appears, check, frameChecksIn, launch, makePoster, runId, screenshot, stroke } from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
await addYourself(page, `Framer ${runId}`);

const visible = (locator) => locator.filter({ visible: true });
const poster = () => visible(page.getByRole("img", { name: /Retro poster made from/ }));
const text = (t) => visible(page.getByText(t));
const heading = (name) => visible(page.getByRole("heading", { name }));
const sendButton = () => visible(page.getByRole("button", { name: "Send to display" }));
async function newPoster(title) {
  await stroke(page, page.getByRole("img", { name: "Drawing canvas" }), [[0.2, 0.8], [0.5, 0.2], [0.8, 0.8]]);
  await makePoster(page, title);
  await poster().waitFor({ timeout: 30000 });
}

check("the header says the display hasn't been seen before it checks in", await appears(text("Display not seen yet")));

const before = await frameChecksIn();
check("a frame with nothing to show gets 204 and its schedule", !before.changed && before.nextCheck === "600");

await newPoster("First light");
const firstPoster = page.url();
// Disabled for a moment while the display's status loads.
await sendButton().waitFor();
await page.waitForFunction((el) => !el.disabled, await sendButton().elementHandle(), { timeout: 10000 }).catch(() => {});
check("the poster page offers Send to display", await sendButton().isEnabled());

await sendButton().click();
await page.waitForURL("**/sent");
await heading("On its way").waitFor({ timeout: 10000 });
check("sending opens the 'on its way' screen", true);
check("…saying when the display will pick it up", await text(/First light shows up when the display next checks in, by about/).isVisible());
check("…with status Waiting", await text("Waiting").isVisible());
check("…replacing nothing yet", await text("Nothing yet").isVisible());
check("…and the e-ink preview", await visible(page.getByRole("img", { name: "First light, as the e-ink display shows it" })).isVisible());
await screenshot(page, "frame-1-on-its-way");

const pickup = await frameChecksIn();
check("the frame downloads a valid image for its panel", pickup.changed && pickup.valid);
check("the frame's ack is accepted", pickup.acked);
await heading("On the display").waitFor({ timeout: 15000 });
check("the screen switches to 'On the display' by itself", await text("Showing").isVisible());
await page.reload();
check("the header says the display is online, with its battery", await appears(text(/^Display online · \d+%$/)));
await screenshot(page, "frame-2-on-the-display");

const again = await frameChecksIn();
check("the frame's next check-in gets 204 (nothing new)", !again.changed);

await page.goto(firstPoster);
check("the poster page says it's on the display", await appears(visible(page.getByRole("link", { name: "On the display now" }))));

// A second poster replaces the first.
await page.goto(firstPoster.replace(/\/result\/.*/, "/draw"));
await newPoster("Second wind");
await page.waitForFunction((el) => !el.disabled, await sendButton().elementHandle());
await sendButton().click();
await page.waitForURL("**/sent");
await heading("On its way").waitFor({ timeout: 10000 });
check("the next poster says which one it replaces", await text("First light").isVisible());
const second = await frameChecksIn();
check("the frame picks up the newer poster", second.changed && second.valid && second.acked);
await heading("On the display").waitFor({ timeout: 15000 });

await page.goto(firstPoster);
await poster().waitFor({ timeout: 15000 });
check("the first poster can be sent again", await appears(sendButton()));
await page.goto(firstPoster + "/sent");
check("its 'on the display' screen says it isn't any more", await appears(heading("Not on the display any more")));

await finish();
