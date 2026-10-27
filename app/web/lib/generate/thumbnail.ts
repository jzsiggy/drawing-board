import sharp from "sharp";

// Poster thumbnails for the gallery grid: a few KB instead of 1-2 MB.
export const THUMB_WIDTH = 360;

export function makeThumbnail(poster: Buffer): Promise<Buffer> {
  return sharp(poster).resize({ width: THUMB_WIDTH }).webp({ quality: 80 }).toBuffer();
}

export function thumbPath(generationId: string) {
  return `${generationId}-thumb.webp`;
}
