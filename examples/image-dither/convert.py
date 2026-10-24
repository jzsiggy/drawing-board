# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10", "numpy>=1.26"]
# ///
"""Dither the image in input/ to the Spectra 6 palette and write image_data.h.

Usage: uv run convert.py [--crop] [--contrast FACTOR] [--saturation FACTOR]
                          [--palette {ideal,measured}] [--dither {floyd,atkinson}]
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

# Native panel size (portrait). Landscape images are rotated to fit.
WIDTH, HEIGHT = 1200, 1600

# (RGB used for dithering, 4-bit code the panel expects; see EPD_13in3e.h)
# Pure primaries: what the panel is asked to show.
PALETTE_IDEAL = [
    ((0, 0, 0), 0x0),        # black
    ((255, 255, 255), 0x1),  # white
    ((255, 255, 0), 0x2),    # yellow
    ((255, 0, 0), 0x3),      # red
    ((0, 0, 255), 0x5),      # blue
    ((0, 255, 0), 0x6),      # green
]

# What the inks actually look like, from Pimoroni's driver for the same
# 13.3" Spectra 6 panel (EL133UF1, SATURATED_PALETTE in inky_el133uf1.py):
# https://github.com/pimoroni/inky/blob/main/inky/inky_el133uf1.py
# Dithering against these makes the error diffusion compensate for the dull
# inks, and makes preview.png closer to the real screen.
PALETTE_MEASURED = [
    ((0, 0, 0), 0x0),        # black
    ((161, 164, 165), 0x1),  # white
    ((208, 190, 71), 0x2),   # yellow
    ((156, 72, 75), 0x3),    # red
    ((61, 59, 94), 0x5),     # blue
    ((58, 91, 70), 0x6),     # green
]

PALETTES = {"ideal": PALETTE_IDEAL, "measured": PALETTE_MEASURED}

HERE = Path(__file__).resolve().parent
INPUT_DIR = HERE / "input"
OUTPUT = HERE / "image_data.h"
PREVIEW = HERE / "preview.png"
EXTENSIONS = {".jpg", ".jpeg", ".png"}


def find_input() -> Path:
    images = [p for p in INPUT_DIR.iterdir() if p.suffix.lower() in EXTENSIONS]
    if not images:
        sys.exit(f"No .jpg/.png found in {INPUT_DIR}")
    image = max(images, key=lambda p: p.stat().st_mtime)
    if len(images) > 1:
        print(f"Several images in input/, using the newest: {image.name}")
    return image


def load(path: Path, crop: bool) -> Image.Image:
    img = ImageOps.exif_transpose(Image.open(path))

    # Flatten transparency onto white, the panel's background colour.
    img = img.convert("RGBA")
    background = Image.new("RGBA", img.size, (255, 255, 255, 255))
    img = Image.alpha_composite(background, img).convert("RGB")

    if img.width > img.height:
        img = img.rotate(90, expand=True)

    if crop:
        return ImageOps.fit(img, (WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    return ImageOps.pad(img, (WIDTH, HEIGHT), Image.Resampling.LANCZOS, color="white")


def boost_contrast(img: Image.Image, factor: float) -> Image.Image:
    return ImageEnhance.Contrast(img).enhance(factor)


def boost_saturation(img: Image.Image, factor: float) -> Image.Image:
    return ImageEnhance.Color(img).enhance(factor)


def fit_to_palette_range(img: Image.Image, palette: list) -> Image.Image:
    """Squeeze each channel into the palette's black..white range.

    With the measured palette, "white" is only ~161 grey, so without this
    everything brighter (e.g. a whole sky) would clip to plain white.
    """
    (black, _), (white, _) = palette[0], palette[1]
    lut = [round(lo + (hi - lo) * v / 255) for lo, hi in zip(black, white) for v in range(256)]
    return img.point(lut)


def dither_floyd_steinberg(img: Image.Image, palette: list) -> bytes:
    """Return one panel colour code per pixel."""
    flat = [c for rgb, _ in palette for c in rgb]
    # Pad the 256-entry palette by repeating the first colour so no extra
    # indices sneak in; anything >= len(palette) is mapped to black below.
    flat += list(palette[0][0]) * (256 - len(palette))
    palette_img = Image.new("P", (1, 1))
    palette_img.putpalette(flat)

    indices = img.quantize(palette=palette_img, dither=Image.Dither.FLOYDSTEINBERG).tobytes()
    codes = bytes(palette[i][1] if i < len(palette) else palette[0][1] for i in range(256))
    return indices.translate(codes)


def dither_atkinson(img: Image.Image, palette: list) -> bytes:
    """Return one panel colour code per pixel.

    Atkinson passes on only 6/8 of each pixel's error (1/8 to each of six
    neighbours), which gives punchier contrast and fewer stray dots than
    Floyd-Steinberg, at the cost of some shadow and highlight detail.
    Runs per pixel in Python, so it takes a few seconds rather than <1s.
    """
    colours = [rgb for rgb, _ in palette]
    codes = [code for _, code in palette]
    pixels = np.asarray(img, dtype=np.float32)
    height, width, _ = pixels.shape
    # Two extra columns each side so neighbours never go out of bounds.
    err = np.zeros((height + 2, width + 4, 3), dtype=np.float32)
    out = bytearray(width * height)

    for y in range(height):
        row = (pixels[y] + err[y, 2:-2]).tolist()
        below = [[0.0, 0.0, 0.0] for _ in range(width + 4)]
        below2 = [[0.0, 0.0, 0.0] for _ in range(width + 4)]
        for x in range(width):
            r, g, b = row[x]
            best, best_dist = 0, float("inf")
            for i, (pr, pg, pb) in enumerate(colours):
                dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
                if dist < best_dist:
                    best, best_dist = i, dist
            out[y * width + x] = codes[best]

            pr, pg, pb = colours[best]
            er, eg, eb = (r - pr) / 8, (g - pg) / 8, (b - pb) / 8
            for nx in (x + 1, x + 2):
                if nx < width:
                    n = row[nx]
                    n[0] += er; n[1] += eg; n[2] += eb
            # below/below2 are offset by 2 to match err's padding.
            for n in (below[x + 1], below[x + 2], below[x + 3], below2[x + 2]):
                n[0] += er; n[1] += eg; n[2] += eb
        err[y + 1] += np.asarray(below, dtype=np.float32)
        err[y + 2] += np.asarray(below2, dtype=np.float32)

    return bytes(out)


DITHERS = {"floyd": dither_floyd_steinberg, "atkinson": dither_atkinson}


def pack_pixels(codes: bytes) -> bytes:
    """Two pixels per byte, left pixel in the high nibble."""
    return bytes((codes[i] << 4) | codes[i + 1] for i in range(0, len(codes), 2))


def write_header(data: bytes, source: Path, settings: str) -> None:
    lines = [
        ",".join(f"0x{b:02x}" for b in data[i:i + 32])
        for i in range(0, len(data), 32)
    ]
    OUTPUT.write_text(
        f"// Generated by convert.py from {source.name}. Do not edit.\n"
        f"// Settings: {settings}\n"
        "#pragma once\n"
        "#include <stdint.h>\n\n"
        f"const uint8_t image_data[{len(data)}] = {{\n"
        + ",\n".join(lines)
        + "\n};\n"
    )


def write_preview(data: bytes, palette: list) -> None:
    """Save what the panel will show, so it can be checked before flashing."""
    rgb_for_code = {code: bytes(rgb) for rgb, code in palette}
    pixels = b"".join(rgb_for_code[n] for b in data for n in (b >> 4, b & 0xF))
    Image.frombytes("RGB", (WIDTH, HEIGHT), pixels).save(PREVIEW)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--crop", action="store_true",
                        help="fill the whole screen by cropping instead of adding white borders")
    parser.add_argument("--contrast", type=float, default=1.0, metavar="FACTOR",
                        help="contrast boost before dithering, e.g. 1.2 (default 1.0 = off)")
    parser.add_argument("--saturation", type=float, default=1.0, metavar="FACTOR",
                        help="saturation boost before dithering, e.g. 1.5 (default 1.0 = off)")
    parser.add_argument("--palette", choices=PALETTES, default="ideal",
                        help="colours to dither against: pure primaries, or the panel's "
                             "measured inks (default ideal)")
    parser.add_argument("--dither", choices=DITHERS, default="floyd",
                        help="error diffusion method (default floyd; atkinson is punchier but slower)")
    args = parser.parse_args()

    source = find_input()
    img = load(source, args.crop)
    settings = ["crop" if args.crop else "pad"]
    # Contrast first, so the saturation boost works on the final tones.
    if args.contrast != 1.0:
        img = boost_contrast(img, args.contrast)
        settings.append(f"contrast {args.contrast}")
    if args.saturation != 1.0:
        img = boost_saturation(img, args.saturation)
        settings.append(f"saturation {args.saturation}")

    palette = PALETTES[args.palette]
    settings.append(f"{args.palette} palette")
    if args.palette == "measured":
        img = fit_to_palette_range(img, palette)
    settings.append(args.dither)
    data = pack_pixels(DITHERS[args.dither](img, palette))
    settings = ", ".join(settings)
    write_header(data, source, settings)
    write_preview(data, palette)
    print(f"Wrote {OUTPUT.name} ({len(data)} bytes) and {PREVIEW.name} from {source.name}")
    print(f"Settings: {settings}")


if __name__ == "__main__":
    main()
