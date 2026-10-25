import sharp from "sharp";

import type { RgbImage } from "./image";

// Named after CSS object-fit, like convert.py's --fit.
export type FitMode = "contain" | "cover" | "fill";

// Decodes any image sharp understands, applies its EXIF orientation, flattens
// transparency onto white, turns landscape images to portrait and fits the
// result to width x height.
export async function loadAndFit(
  input: Buffer,
  width: number,
  height: number,
  fit: FitMode,
): Promise<RgbImage> {
  const upright = await sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let image = sharp(upright.data, {
    raw: { width: upright.info.width, height: upright.info.height, channels: 3 },
  });
  // Counter-clockwise, as Pillow's rotate(90) in convert.py.
  if (upright.info.width > upright.info.height) image = image.rotate(270);

  const { data, info } = await image
    .resize(width, height, { fit, background: "#ffffff", kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}
