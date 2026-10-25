// Error diffusion to a panel palette. Both return one panel colour code per
// pixel, rows top to bottom.

import type { PaletteEntry } from "./panels";
import type { RgbImage } from "./image";

export type DitherName = "floyd" | "atkinson";

function nearest(palette: PaletteEntry[], r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i].rgb;
    const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

// One error-diffusion pass. `kernel` lists [dx, dy, weight] neighbours; each
// gets weight * error. Floyd-Steinberg clamps like Pillow does, Atkinson
// doesn't, matching convert.py.
function diffuse(
  img: RgbImage,
  palette: PaletteEntry[],
  kernel: readonly (readonly [number, number, number])[],
  clamp: boolean,
): Uint8Array {
  const { width, height, data } = img;
  const work = Float32Array.from(data);
  const codes = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      let r = work[i];
      let g = work[i + 1];
      let b = work[i + 2];
      if (clamp) {
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));
      }
      const index = nearest(palette, r, g, b);
      codes[y * width + x] = palette[index].code;

      const [pr, pg, pb] = palette[index].rgb;
      const er = r - pr;
      const eg = g - pg;
      const eb = b - pb;
      for (const [dx, dy, weight] of kernel) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) continue;
        const n = (ny * width + nx) * 3;
        work[n] += er * weight;
        work[n + 1] += eg * weight;
        work[n + 2] += eb * weight;
      }
    }
  }
  return codes;
}

const FLOYD_STEINBERG = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
] as const;

// Passes on only 6/8 of the error: punchier contrast and fewer stray dots,
// at the cost of some shadow and highlight detail.
const ATKINSON = [
  [1, 0, 1 / 8],
  [2, 0, 1 / 8],
  [-1, 1, 1 / 8],
  [0, 1, 1 / 8],
  [1, 1, 1 / 8],
  [0, 2, 1 / 8],
] as const;

export function ditherFloydSteinberg(img: RgbImage, palette: PaletteEntry[]): Uint8Array {
  return diffuse(img, palette, FLOYD_STEINBERG, true);
}

export function ditherAtkinson(img: RgbImage, palette: PaletteEntry[]): Uint8Array {
  return diffuse(img, palette, ATKINSON, false);
}

export const DITHERS: Record<DitherName, (img: RgbImage, palette: PaletteEntry[]) => Uint8Array> = {
  floyd: ditherFloydSteinberg,
  atkinson: ditherAtkinson,
};
