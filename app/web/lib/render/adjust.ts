// Optional tweaks before dithering. Each returns a new image and matches the
// Pillow ImageEnhance behaviour convert.py uses.

import type { PaletteEntry } from "./panels";
import { clamp8, luma, type RgbImage } from "./image";

// Pillow's Image.blend(degenerate, image, factor), which truncates.
function blend(degenerate: number, value: number, factor: number): number {
  return clamp8(Math.trunc(degenerate + factor * (value - degenerate)));
}

// Pushes every channel away from the image's mean grey.
export function boostContrast(img: RgbImage, factor: number): RgbImage {
  const { data } = img;
  let sum = 0;
  for (let i = 0; i < data.length; i += 3) sum += luma(data[i], data[i + 1], data[i + 2]);
  const mean = Math.trunc(sum / (data.length / 3) + 0.5);

  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = blend(mean, data[i], factor);
  return { ...img, data: out };
}

// Pushes every pixel away from its own grey value.
export function boostSaturation(img: RgbImage, factor: number): RgbImage {
  const { data } = img;
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 3) {
    const grey = luma(data[i], data[i + 1], data[i + 2]);
    out[i] = blend(grey, data[i], factor);
    out[i + 1] = blend(grey, data[i + 1], factor);
    out[i + 2] = blend(grey, data[i + 2], factor);
  }
  return { ...img, data: out };
}

// Squeezes each channel into the palette's black..white range. With the
// measured palette, "white" is only ~161 grey, so without this everything
// brighter (e.g. a whole sky) would clip to plain white.
export function fitToPaletteRange(img: RgbImage, palette: PaletteEntry[]): RgbImage {
  const black = palette[0].rgb;
  const white = palette[1].rgb;
  const luts = [0, 1, 2].map((c) =>
    Uint8Array.from({ length: 256 }, (_, v) =>
      Math.round(black[c] + ((white[c] - black[c]) * v) / 255),
    ),
  );
  const { data } = img;
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = luts[i % 3][data[i]];
  return { ...img, data: out };
}
