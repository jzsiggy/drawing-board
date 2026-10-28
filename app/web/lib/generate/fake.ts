import sharp from "sharp";

import type { GenerateInput, ImageGenerator } from "./types";

const TINTS = ["#c4302b", "#2a5bb8", "#2f8a4a", "#e8742a"];
const TITLES = ["Harbour at Dusk", "Summer Express", "The Red Hills", "Night Garden"];

// Stand-in for the real model during local development and tests: waits a
// moment and returns a tinted, posterised copy of the sketch. Each call uses
// the next tint and a band at a new height, so versions always differ like
// real ones do (thin lines can vanish in the posterising). Never used unless
// IMAGE_GENERATOR=fake.
export class FakeImageGenerator implements ImageGenerator {
  readonly model = "fake";
  private static calls = 0;
  private static titles = 0;

  async generate({ sketch }: GenerateInput): Promise<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const call = FakeImageGenerator.calls++;
    const tint = TINTS[call % TINTS.length];
    const band = await sharp({ create: { width: 896, height: 60, channels: 3, background: tint } }).png().toBuffer();
    const posterised = await sharp(sketch)
      .resize(896, 1195, { fit: "cover" })
      .flatten({ background: "#f3ecd8" })
      .tint(tint)
      .threshold(200, { grayscale: false })
      .png()
      .toBuffer();
    return sharp(posterised)
      .composite([{ input: band, top: 60 + ((call * 97) % 1000), left: 0 }])
      .png()
      .toBuffer();
  }

  async suggestTitle(): Promise<string> {
    return TITLES[FakeImageGenerator.titles++ % TITLES.length];
  }
}
