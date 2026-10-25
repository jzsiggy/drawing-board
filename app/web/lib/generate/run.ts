// Creating and running a generation: drawing -> image model -> signed poster.

import type { StrokeDoc } from "@/lib/strokes";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { getImageGenerator } from "./generator";
import { DEFAULT_PRESET, PRESETS, type PresetId } from "./presets";
import { signPoster } from "./sign";
import { GenerationError } from "./types";

// A generation still pending or running after this long has died with its
// function (e.g. a Vercel timeout) and is reported as failed.
export const STALE_AFTER_MS = 5 * 60 * 1000;

export async function createGeneration(drawingId: string, presetId: PresetId = DEFAULT_PRESET) {
  const preset = PRESETS[presetId];
  const { data, error } = await createAdminClient()
    .from("generations")
    .insert({
      drawing_id: drawingId,
      preset_id: preset.id,
      preset_version: preset.version,
      prompt: preset.prompt,
      model: getImageGenerator().model,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function runGeneration(id: string) {
  const supabase = createAdminClient();
  const update = async (fields: TablesUpdate<"generations">) => {
    const { error } = await supabase.from("generations").update(fields).eq("id", id);
    if (error) throw error;
  };

  try {
    await update({ status: "running", started_at: new Date().toISOString() });

    const { data: generation, error } = await supabase
      .from("generations")
      .select("prompt, drawing:drawings(sketch_path, artist:people(signature_strokes))")
      .eq("id", id)
      .single();
    if (error) throw error;
    const drawing = generation.drawing;
    if (!drawing?.artist) throw new Error(`Generation ${id} has no drawing or artist`);

    const sketch = await supabase.storage.from("sketches").download(drawing.sketch_path);
    if (sketch.error) throw sketch.error;

    const poster = await getImageGenerator().generate({
      sketch: Buffer.from(await sketch.data.arrayBuffer()),
      prompt: generation.prompt,
      aspectRatio: "3:4",
    });
    const signed = await signPoster(poster, drawing.artist.signature_strokes as unknown as StrokeDoc);

    const imagePath = `${id}.png`;
    const signedPath = `${id}-signed.png`;
    for (const [path, bytes] of [
      [imagePath, poster],
      [signedPath, signed],
    ] as const) {
      const upload = await supabase.storage.from("generations").upload(path, bytes, { contentType: "image/png" });
      if (upload.error) throw upload.error;
    }

    await update({
      status: "succeeded",
      image_path: imagePath,
      signed_path: signedPath,
      finished_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`Generation ${id} failed:`, e);
    // Only model refusals and the like are worth showing word for word.
    const message =
      e instanceof GenerationError ? e.message : "Something went wrong while making the poster. Try again.";
    await update({ status: "failed", error: message, finished_at: new Date().toISOString() }).catch((err) =>
      console.error(`Couldn't mark generation ${id} as failed:`, err),
    );
  }
}
