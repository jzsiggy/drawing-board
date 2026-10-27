// Makes gallery thumbnails for posters created before thumbnails existed.
// Safe to run more than once: only touches posters without one.
//
// Usage: npx tsx scripts/backfill-thumbnails.ts [--dry-run]

import "./load-env";

import { makeThumbnail, thumbPath } from "@/lib/generate/thumbnail";
import { createAdminClient } from "@/lib/supabase/admin";

const dryRun = process.argv.includes("--dry-run");
const supabase = createAdminClient();

const { data, error } = await supabase
  .from("generations")
  .select("id, signed_path")
  .eq("status", "succeeded")
  .is("thumb_path", null)
  .not("signed_path", "is", null);
if (error) throw error;

console.log(`${data.length} poster(s) without a thumbnail${dryRun ? " (dry run, nothing written)" : ""}`);
for (const generation of data) {
  if (dryRun) {
    console.log(`  would make ${thumbPath(generation.id)}`);
    continue;
  }
  const poster = await supabase.storage.from("generations").download(generation.signed_path!);
  if (poster.error) throw poster.error;
  const path = thumbPath(generation.id);
  const upload = await supabase.storage
    .from("generations")
    .upload(path, await makeThumbnail(Buffer.from(await poster.data.arrayBuffer())), {
      contentType: "image/webp",
      upsert: true,
    });
  if (upload.error) throw upload.error;
  const { error: updateError } = await supabase.from("generations").update({ thumb_path: path }).eq("id", generation.id);
  if (updateError) throw updateError;
  console.log(`  made ${path}`);
}
