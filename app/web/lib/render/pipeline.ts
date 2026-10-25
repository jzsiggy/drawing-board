// Image in, frame file out: fit -> contrast -> saturation -> palette range ->
// dither -> pack. The same steps and settings as examples/image-dither/convert.py.

import { createHash } from "node:crypto";
import sharp from "sharp";

import { boostContrast, boostSaturation, fitToPaletteRange } from "./adjust";
import { DITHERS, type DitherName } from "./dither";
import { loadAndFit, type FitMode } from "./fit";
import { buildFrameFile, packPixels } from "./pack";
import { getPanel, type PaletteName } from "./panels";

export interface RenderSettings {
  fit: FitMode;
  contrast: number;
  saturation: number;
  palette: PaletteName;
  dither: DitherName;
}

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  fit: "cover",
  contrast: 1,
  saturation: 1,
  palette: "ideal",
  dither: "floyd",
};

// Picks the render settings out of a board's settings JSON, falling back to
// the defaults for anything missing or invalid.
export function renderSettingsFrom(raw: unknown): RenderSettings {
  const s = (raw ?? {}) as Partial<Record<keyof RenderSettings, unknown>>;
  const pick = <T>(value: unknown, allowed: readonly T[], fallback: T) =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const factor = (value: unknown) =>
    typeof value === "number" && value > 0 && value <= 4 ? value : 1;
  return {
    fit: pick(s.fit, ["contain", "cover", "fill"] as const, DEFAULT_RENDER_SETTINGS.fit),
    contrast: factor(s.contrast),
    saturation: factor(s.saturation),
    palette: pick(s.palette, ["ideal", "measured"] as const, DEFAULT_RENDER_SETTINGS.palette),
    dither: pick(s.dither, ["floyd", "atkinson"] as const, DEFAULT_RENDER_SETTINGS.dither),
  };
}

// Stable short id for a set of settings, part of a rendition's cache key.
export function settingsHash(settings: RenderSettings): string {
  const keys = Object.keys(settings).sort() as (keyof RenderSettings)[];
  const stable = JSON.stringify(keys.map((k) => [k, settings[k]]));
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

export interface Rendered {
  file: Buffer;
  sha256: string;
  // One colour code per pixel, for previews.
  codes: Uint8Array;
}

export async function renderForPanel(
  input: Buffer,
  panelType: string,
  settings: RenderSettings,
): Promise<Rendered> {
  const panel = getPanel(panelType);
  const palette = panel.palettes[settings.palette];

  let img = await loadAndFit(input, panel.width, panel.height, settings.fit);
  // Contrast first, so the saturation boost works on the final tones.
  if (settings.contrast !== 1) img = boostContrast(img, settings.contrast);
  if (settings.saturation !== 1) img = boostSaturation(img, settings.saturation);
  if (settings.palette === "measured") img = fitToPaletteRange(img, palette);

  const codes = DITHERS[settings.dither](img, palette);
  const file = buildFrameFile(panel, packPixels(codes));
  return { file, sha256: createHash("sha256").update(file).digest("hex"), codes };
}

// What the panel will show, drawn with the given palette's colours.
export async function renderPreviewPng(
  codes: Uint8Array,
  panelType: string,
  paletteName: PaletteName,
): Promise<Buffer> {
  const panel = getPanel(panelType);
  const rgbByCode = new Map(panel.palettes[paletteName].map((e) => [e.code, e.rgb]));
  const rgb = new Uint8Array(codes.length * 3);
  codes.forEach((code, i) => rgb.set(rgbByCode.get(code) ?? [255, 0, 255], i * 3));
  return sharp(rgb, { raw: { width: panel.width, height: panel.height, channels: 3 } })
    .png()
    .toBuffer();
}
