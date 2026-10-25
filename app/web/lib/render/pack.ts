import type { Panel } from "./panels";

const MAGIC = "EPD1";
const FORMAT_VERSION = 1;
export const HEADER_SIZE = 16;

// Two pixels per byte, left pixel in the high nibble.
export function packPixels(codes: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(codes.length / 2));
  for (let i = 0; i < codes.length; i += 2) {
    out[i >> 1] = (codes[i] << 4) | (codes[i + 1] ?? 0);
  }
  return out;
}

// The file a frame downloads; layout in app/docs/frame-protocol.md.
export function buildFrameFile(panel: Panel, payload: Uint8Array): Buffer {
  const file = Buffer.alloc(HEADER_SIZE + payload.length);
  file.write(MAGIC, 0, "ascii");
  file.writeUInt8(FORMAT_VERSION, 4);
  file.writeUInt8(panel.headerId, 5);
  file.writeUInt16LE(0, 6);
  file.writeUInt16LE(panel.width, 8);
  file.writeUInt16LE(panel.height, 10);
  file.writeUInt32LE(payload.length, 12);
  file.set(payload, HEADER_SIZE);
  return file;
}
