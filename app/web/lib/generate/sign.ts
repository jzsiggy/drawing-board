// Adds the artist's signature to the bottom-right corner of a poster.

import sharp from "sharp";

import { strokePath, type StrokeDoc } from "@/lib/strokes";

const SIGNATURE_WIDTH = 0.18; // of the poster's width
const MARGIN = 0.03; // of the poster's width
const INK = "#1b1e20";
const PAPER = "#ffffff";

export async function signPoster(poster: Buffer, signature: StrokeDoc): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(poster).metadata();
  const sigWidth = Math.round(width * SIGNATURE_WIDTH);
  const sigHeight = Math.round(sigWidth / signature.aspect);
  const margin = Math.round(width * MARGIN);
  const left = width - margin - sigWidth;
  const top = height - margin - sigHeight;

  // Dark ink on a light corner, light ink on a dark one.
  const corner = await sharp(poster).extract({ left, top, width: sigWidth, height: sigHeight }).stats();
  const [r, g, b] = corner.channels.map((c) => c.mean);
  const color = 0.299 * r + 0.587 * g + 0.114 * b > 128 ? INK : PAPER;

  // Redrawn from the strokes at this size, so it stays crisp.
  const paths = signature.strokes
    .map((stroke) => `<path d="${strokePath(stroke, sigWidth, sigHeight)}" fill="${color}"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sigWidth}" height="${sigHeight}">${paths}</svg>`;

  return sharp(poster)
    .composite([{ input: Buffer.from(svg), left, top }])
    .png()
    .toBuffer();
}
