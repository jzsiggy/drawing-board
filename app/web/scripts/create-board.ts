// Registers a frame and writes its token into the firmware's config.h (or
// prints it with --print). Only the token's hash is stored.
//
// Usage: npx tsx scripts/create-board.ts "Living room" [--panel spectra6-13in3]
//        [--config ../firmware/frame/config.h | --print]

import "./load-env";

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { hashToken, newBoardToken } from "@/lib/frames/boards";
import { getPanel } from "@/lib/render/panels";
import { createAdminClient } from "@/lib/supabase/admin";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    panel: { type: "string", default: "spectra6-13in3" },
    config: { type: "string", default: "../firmware/frame/config.h" },
    print: { type: "boolean", default: false },
  },
});

const name = positionals[0];
if (!name) {
  console.error('Usage: npx tsx scripts/create-board.ts "Living room"');
  process.exit(1);
}
getPanel(values.panel);

// Check config.h before creating anything, so a typo doesn't leave an orphan board.
const TOKEN_LINE = /^#define BOARD_TOKEN\s+"[^"]*"/m;
const config = values.print ? "" : await readFile(values.config, "utf8");
if (!values.print && !TOKEN_LINE.test(config)) {
  console.error(`No "#define BOARD_TOKEN" line in ${values.config}`);
  process.exit(1);
}

const token = newBoardToken();
const { data, error } = await createAdminClient()
  .from("boards")
  .insert({ name, panel_type: values.panel, token_hash: hashToken(token) })
  .select("id")
  .single();
if (error) throw error;

console.log(`Created board "${name}" (${data.id})`);
if (values.print) {
  console.log(`\n#define BOARD_TOKEN "${token}"`);
} else {
  await writeFile(values.config, config.replace(TOKEN_LINE, `#define BOARD_TOKEN     "${token}"`));
  console.log(`Wrote its token to ${values.config}`);
}
