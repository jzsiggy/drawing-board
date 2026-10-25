import sharp from "sharp";

import type { GenerateInput, ImageGenerator } from "./types";

// Stand-in for the real model during local development and tests: waits a
// moment and returns a tinted, posterised copy of the sketch. Never used
// unless IMAGE_GENERATOR=fake.
export class FakeImageGenerator implements ImageGenerator {
  readonly model = "fake";

  async generate({ sketch }: GenerateInput): Promise<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return sharp(sketch)
      .resize(896, 1195, { fit: "cover" })
      .flatten({ background: "#f3ecd8" })
      .tint("#c4302b")
      .threshold(200, { grayscale: false })
      .png()
      .toBuffer();
  }
}
