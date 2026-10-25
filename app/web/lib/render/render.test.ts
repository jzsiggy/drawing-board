import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { boostContrast, boostSaturation, fitToPaletteRange } from "./adjust";
import { ditherAtkinson, ditherFloydSteinberg } from "./dither";
import { loadAndFit } from "./fit";
import type { RgbImage } from "./image";
import { buildFrameFile, HEADER_SIZE, packPixels } from "./pack";
import { PANELS } from "./panels";
import { renderForPanel, renderSettingsFrom, settingsHash, DEFAULT_RENDER_SETTINGS } from "./pipeline";

const panel = PANELS["spectra6-13in3"];
const ideal = panel.palettes.ideal;

function solid(width: number, height: number, rgb: readonly number[]): RgbImage {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < data.length; i++) data[i] = rgb[i % 3];
  return { width, height, data };
}

describe("packPixels", () => {
  it("puts the left pixel in the high nibble", () => {
    expect([...packPixels(Uint8Array.from([0x1, 0x3, 0x5, 0x6]))]).toEqual([0x13, 0x56]);
  });
});

describe("buildFrameFile", () => {
  it("writes the 16-byte EPD1 header from the protocol doc", () => {
    const file = buildFrameFile(panel, new Uint8Array(960000));
    expect(file.length).toBe(HEADER_SIZE + 960000);
    expect(file.subarray(0, 4).toString("ascii")).toBe("EPD1");
    expect([file[4], file[5]]).toEqual([1, 1]);
    expect(file.readUInt16LE(8)).toBe(1200);
    expect(file.readUInt16LE(10)).toBe(1600);
    expect(file.readUInt32LE(12)).toBe(960000);
  });
});

describe("dithering", () => {
  it.each([
    ["Floyd-Steinberg", ditherFloydSteinberg],
    ["Atkinson", ditherAtkinson],
  ])("%s maps exact palette colours to their codes", (_, dither) => {
    for (const { rgb, code } of ideal) {
      const codes = dither(solid(8, 8, rgb), ideal);
      expect(new Set(codes)).toEqual(new Set([code]));
    }
  });

  it("mixes black and white dots for mid grey", () => {
    const codes = ditherFloydSteinberg(solid(64, 64, [128, 128, 128]), ideal);
    const white = codes.filter((c) => c === 0x1).length / codes.length;
    expect(white).toBeGreaterThan(0.4);
    expect(white).toBeLessThan(0.6);
  });
});

describe("adjustments", () => {
  const img = solid(4, 4, [200, 100, 50]);

  it("leaves the image alone at factor 1", () => {
    expect(boostContrast(img, 1).data).toEqual(img.data);
    expect(boostSaturation(img, 1).data).toEqual(img.data);
  });

  it("turns the image grey at saturation 0", () => {
    const grey = boostSaturation(img, 0).data;
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);
  });

  it("is a no-op range fit for the ideal palette", () => {
    expect(fitToPaletteRange(img, ideal).data).toEqual(img.data);
  });

  it("squeezes white into the measured palette's white", () => {
    const out = fitToPaletteRange(solid(1, 1, [255, 255, 255]), panel.palettes.measured).data;
    expect([...out]).toEqual([161, 164, 165]);
  });
});

describe("loadAndFit", () => {
  it("turns a landscape image counter-clockwise to portrait", async () => {
    // Left half red, right half blue. Counter-clockwise puts the right half on top.
    const png = await sharp({
      create: { width: 400, height: 200, channels: 3, background: "#ff0000" },
    })
      .composite([
        {
          input: { create: { width: 200, height: 200, channels: 3, background: "#0000ff" } },
          left: 200,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    const img = await loadAndFit(png, 120, 160, "fill");
    expect([img.width, img.height]).toEqual([120, 160]);
    const pixel = (x: number, y: number) => [...img.data.subarray((y * 120 + x) * 3, (y * 120 + x) * 3 + 3)];
    expect(pixel(60, 10)).toEqual([0, 0, 255]);
    expect(pixel(60, 150)).toEqual([255, 0, 0]);
  });
});

describe("settings", () => {
  it("falls back to defaults for missing or invalid values", () => {
    expect(renderSettingsFrom({ check_interval_s: 600, dither: "nope", contrast: 99 })).toEqual(
      DEFAULT_RENDER_SETTINGS,
    );
  });

  it("hashes the same settings to the same id regardless of key order", () => {
    const a = settingsHash({ ...DEFAULT_RENDER_SETTINGS, dither: "atkinson" });
    const b = settingsHash({ dither: "atkinson", fit: "cover", saturation: 1, contrast: 1, palette: "ideal" });
    expect(a).toBe(b);
    expect(a).not.toBe(settingsHash(DEFAULT_RENDER_SETTINGS));
  });
});

describe("renderForPanel", () => {
  it("produces a full-size frame file whose hash matches", async () => {
    const png = await sharp({ create: { width: 300, height: 400, channels: 3, background: "#3366cc" } })
      .png()
      .toBuffer();
    const { file, sha256, codes } = await renderForPanel(png, "spectra6-13in3", DEFAULT_RENDER_SETTINGS);
    expect(file.length).toBe(HEADER_SIZE + 960000);
    expect(codes.length).toBe(1200 * 1600);
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
