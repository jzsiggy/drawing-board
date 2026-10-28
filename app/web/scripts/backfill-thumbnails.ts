// Makes gallery thumbnails and e-ink previews for posters created before
// they existed. Safe to run more than once: only touches posters missing one.
//
// Usage: npx tsx scripts/backfill-thumbnails.ts [--dry-run]

import "./load-env";

import { makeEinkPreview, previewPath } from "@/lib/generate/preview";
import { makeThumbnail, thumbPath } from "@/lib/generate/thumbnail";
import { createAdminClient } from "@/lib/supabase/admin";

const dryRun = process.argv.includes("--dry-run");
const supabase = createAdminClient();

const { data, error } = await supabase
  .from("generations")
  .select("id, signed_path, thumb_path, preview_path")
  .eq("status", "succeeded")
  .or("thumb_path.is.null,preview_path.is.null")
  .not("signed_path", "is", null);
if (error) throw error;

console.log(`${data.length} poster(s) missing a thumbnail or preview${dryRun ? " (dry run, nothing written)" : ""}`);
for (const generation of data) {
  const jobs = [
    !generation.thumb_path && { column: "thumb_path" as const, path: thumbPath(generation.id), type: "image/webp", make: makeThumbnail },
    !generation.preview_path && { column: "preview_path" as const, path: previewPath(generation.id), type: "image/png", make: makeEinkPreview },
  ].filter((job) => job !== false);
  if (dryRun) {
    for (const job of jobs) console.log(`  would make ${job.path}`);
    continue;
  }
  const poster = await supabase.storage.from("generations").download(generation.signed_path!);
  if (poster.error) throw poster.error;
  const bytes = Buffer.from(await poster.data.arrayBuffer());
  for (const job of jobs) {
    const upload = await supabase.storage
      .from("generations")
      .upload(job.path, await job.make(bytes), { contentType: job.type, upsert: true });
    if (upload.error) throw upload.error;
    const { error: updateError } = await supabase
      .from("generations")
      .update(job.column === "thumb_path" ? { thumb_path: job.path } : { preview_path: job.path })
      .eq("id", generation.id);
    if (updateError) throw updateError;
    console.log(`  made ${job.path}`);
  }
}
