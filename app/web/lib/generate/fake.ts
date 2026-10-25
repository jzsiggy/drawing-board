import sharp from "sharp";

import type { GenerateInput, ImageGenerator } from "./types";

const TINTS = ["#c4302b", "#2a5bb8", "#2f8a4a", "#e8742a"];

// Stand-in for the real model during local development and tests: waits a
// moment and returns a tinted, posterised copy of the sketch. Each call uses
// the next tint, so versions differ like real ones do. Never used unless
// IMAGE_GENERATOR=fake.
export class FakeImageGenerator implements ImageGenerator {
  readonly model = "fake";
  private static calls = 0;

  async generate({ sketch }: GenerateInput): Promise<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return sharp(sketch)
      .resize(896, 1195, { fit: "cover" })
      .flatten({ background: "#f3ecd8" })
      .tint(TINTS[FakeImageGenerator.calls++ % TINTS.length])
      .threshold(200, { grayscale: false })
      .png()
      .toBuffer();
  }
}
