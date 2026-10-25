// "Send to frame": the frame panel on the poster page, with this script
// playing the frame (check in, download, ack) against the test frame that
// run.mjs creates.
import { addYourself, check, frameChecksIn, launch, runId, screenshot, stroke } from "./lib.mjs";

const { newPhone, finish } = await launch();
const page = await newPhone();
await addYourself(page, `Framer ${runId}`);

const poster = () => page.getByRole("img", { name: /Retro poster made from/ });
// Visited pages stay in the DOM, hidden, so match visible text only.
const text = (t) => page.getByText(t).filter({ visible: true });
const sendButton = () => page.getByRole("button", { name: "Send to frame" });
async function makePoster() {
  await stroke(page, page.getByRole("img", { name: "Drawing canvas" }), [[0.2, 0.8], [0.5, 0.2], [0.8, 0.8]]);
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForURL("**/result/**");
  await poster().waitFor({ timeout: 30000 });
}

const before = await frameChecksIn();
check("a frame with nothing to show gets 204 and its schedule", !before.changed && before.nextCheck === "600");

await makePoster();
const firstPoster = page.url();
await sendButton().waitFor();
check("the poster page offers Send to frame", true);
check("it shows the frame's last check-in", await text(/checked in/).isVisible());
await screenshot(page, "frame-1-before-send");

await sendButton().click();
await text(/Sent\. It shows up when the frame checks in/).waitFor({ timeout: 10000 });
check("after sending it says when the frame will pick it up", true);
await screenshot(page, "frame-2-waiting");

const pickup = await frameChecksIn();
check("the frame downloads a valid image for its panel", pickup.changed && pickup.valid);
check("the frame's ack is accepted", pickup.acked);
await text("On the frame now").waitFor({ timeout: 15000 });
check("the page switches to 'On the frame now' by itself", true);
check("the page shows the frame's battery", await text(/Battery \d+%/).isVisible());
await screenshot(page, "frame-3-on-the-frame");

const again = await frameChecksIn();
check("the frame's next check-in gets 204 (nothing new)", !again.changed);

// A second version replaces the first on the frame.
await page.getByRole("button", { name: "Try again" }).click();
await page.waitForURL((url) => url.href.includes("/result/") && url.href !== firstPoster);
await poster().waitFor({ timeout: 30000 });
await sendButton().click();
await text(/Sent\. It shows up/).waitFor({ timeout: 10000 });
const second = await frameChecksIn();
check("the frame picks up the newer poster", second.changed && second.valid && second.acked);
await text("On the frame now").waitFor({ timeout: 15000 });

await page.goto(firstPoster);
await poster().waitFor({ timeout: 15000 });
await text(/on the frame earlier/).waitFor({ timeout: 10000 });
check("the first poster now says it was replaced", true);
check("…and can be sent again", await sendButton().isEnabled());

await finish();
