import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { SIGNATURE_ASPECT, type StrokeDoc } from "@/lib/strokes";
import { signPoster } from "./sign";

// A thick horizontal line across the middle of the signature box.
const signature: StrokeDoc = {
  version: 1,
  aspect: SIGNATURE_ASPECT,
  strokes: [{ tool: "pen", color: "#1b1e20", size: 0.08, points: [[0.1, 0.5, 0.5], [0.9, 0.5, 0.5]] }],
};

async function poster(background: string) {
  return sharp({ create: { width: 900, height: 1200, channels: 3, background } }).png().toBuffer();
}

async function pixel(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

// Signature box: 18% of 900 = 162 wide, 162 / 2.5 ≈ 65 tall, 27 px margin.
const MIDDLE_OF_SIGNATURE = { x: 900 - 27 - 81, y: 1200 - 27 - 32 };

describe("signPoster", () => {
  it("signs a light corner in dark ink", async () => {
    const signed = await signPoster(await poster("#ffffff"), signature);
    const [r, g, b] = await pixel(signed, MIDDLE_OF_SIGNATURE.x, MIDDLE_OF_SIGNATURE.y);
    expect(r + g + b).toBeLessThan(150);
  });

  it("signs a dark corner in light ink", async () => {
    const signed = await signPoster(await poster("#202020"), signature);
    const [r, g, b] = await pixel(signed, MIDDLE_OF_SIGNATURE.x, MIDDLE_OF_SIGNATURE.y);
    expect(r + g + b).toBeGreaterThan(600);
  });

  it("leaves the rest of the poster alone and keeps its size", async () => {
    const signed = await signPoster(await poster("#ffffff"), signature);
    const meta = await sharp(signed).metadata();
    expect([meta.width, meta.height]).toEqual([900, 1200]);
    expect(await pixel(signed, 100, 100)).toEqual([255, 255, 255]);
    expect(await pixel(signed, 450, 1180)).toEqual([255, 255, 255]);
  });
});
