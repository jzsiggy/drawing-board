import { drawStrokes, type Stroke } from "@/lib/strokes";

// Renders strokes at a fixed resolution onto white paper, for upload.
export function strokesToPng(strokes: Stroke[], width: number, height: number): Promise<Blob> {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  drawStrokes(layer.getContext("2d")!, strokes, width, height);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(layer, 0, 0);

  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))), "image/png"),
  );
}
