// Uncompressed 8-bit RGB, 3 bytes per pixel, rows top to bottom.
export interface RgbImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export function clamp8(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

// Pillow's RGB -> "L" conversion (ITU-R 601-2 luma, rounded), so the
// adjustments below match convert.py.
export function luma(r: number, g: number, b: number): number {
  return (r * 19595 + g * 38470 + b * 7471 + 0x8000) >> 16;
}
