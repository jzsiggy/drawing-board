// Renders an image with the server's pipeline and saves what the panel would
// show, without touching the database. Handy for comparing with convert.py.
//
// Usage: npx tsx scripts/preview.ts <image> [out.png] [--fit cover] [--contrast 1.2]
//        [--saturation 1.5] [--palette measured] [--dither atkinson]

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { renderForPanel, renderPreviewPng, renderSettingsFrom } from "@/lib/render/pipeline";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    fit: { type: "string" },
    contrast: { type: "string" },
    saturation: { type: "string" },
    palette: { type: "string" },
    dither: { type: "string" },
    panel: { type: "string", default: "spectra6-13in3" },
  },
});

const [input, output = "preview.png"] = positionals;
if (!input) {
  console.error("Usage: npx tsx scripts/preview.ts <image> [out.png] [options]");
  process.exit(1);
}

const settings = renderSettingsFrom({
  fit: values.fit,
  contrast: values.contrast ? Number(values.contrast) : undefined,
  saturation: values.saturation ? Number(values.saturation) : undefined,
  palette: values.palette,
  dither: values.dither,
});

const started = performance.now();
const { codes, sha256 } = await renderForPanel(await readFile(input), values.panel, settings);
await writeFile(output, await renderPreviewPng(codes, values.panel, settings.palette));
console.log(`Wrote ${output} in ${Math.round(performance.now() - started)} ms`);
console.log(`Settings: ${JSON.stringify(settings)}`);
console.log(`sha256: ${sha256}`);
