// Sends an image file to a frame, as "Send to frame" will from the app.
// The frame shows it on its next check.
//
// Usage: npx tsx scripts/send-image.ts <image> [--board <id>]
//        (--board can be left out when there is only one board)

import "./load-env";

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseArgs } from "node:util";

import { sendImageToBoard } from "@/lib/frames/send";
import { createAdminClient } from "@/lib/supabase/admin";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { board: { type: "string" } },
});

const imagePath = positionals[0];
if (!imagePath) {
  console.error("Usage: npx tsx scripts/send-image.ts <image> [--board <id>]");
  process.exit(1);
}

let boardId = values.board;
if (!boardId) {
  const { data, error } = await createAdminClient().from("boards").select("id, name");
  if (error) throw error;
  if (data.length !== 1) {
    console.error(`Found ${data.length} boards; pick one with --board:`);
    for (const b of data) console.error(`  ${b.id}  ${b.name}`);
    process.exit(1);
  }
  boardId = data[0].id;
}

const started = performance.now();
const result = await sendImageToBoard({
  boardId,
  image: await readFile(imagePath),
  sourcePath: `script:${basename(imagePath)}`,
});
console.log(`Sent ${basename(imagePath)} in ${Math.round(performance.now() - started)} ms`);
console.log(`Rendition ${result.renditionId}, sha256 ${result.sha256.slice(0, 12)}…`);
console.log(`Settings: ${JSON.stringify(result.settings)}`);
