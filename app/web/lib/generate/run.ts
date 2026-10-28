// Creating and running a generation: drawing -> image model -> signed poster.

import { cleanSuggestedTitle } from "@/lib/posters";
import type { StrokeDoc } from "@/lib/strokes";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { getImageGenerator } from "./generator";
import { DEFAULT_PRESET, PRESETS, type PresetId } from "./presets";
import { signPoster } from "./sign";
import { makeEinkPreview, previewPath } from "./preview";
import { makeThumbnail, thumbPath } from "./thumbnail";
import { GenerationError } from "./types";

// A generation still pending or running after this long has died with its
// function (e.g. a Vercel timeout) and is reported as failed.
export const STALE_AFTER_MS = 5 * 60 * 1000;

export function isStale(generation: { status: string; created_at: string }) {
  const unfinished = generation.status === "pending" || generation.status === "running";
  return unfinished && Date.now() - new Date(generation.created_at).getTime() > STALE_AFTER_MS;
}

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
      .select("prompt, drawing_id, drawing:drawings(title, sketch_path, artist:people(signature_strokes))")
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

    const upload = async (path: string, bytes: Buffer, contentType: string) => {
      const { error: uploadError } = await supabase.storage.from("generations").upload(path, bytes, { contentType });
      if (uploadError) throw uploadError;
    };

    const imagePath = `${id}.png`;
    const signedPath = `${id}-signed.png`;
    const thumb = thumbPath(id);
    await upload(imagePath, poster, "image/png");
    await upload(signedPath, signed, "image/png");
    await upload(thumb, await makeThumbnail(signed), "image/webp");
    // Still running: the image exists, the e-ink preview comes next (the
    // generating screen shows this as "Fitting it to the display's six inks").
    await update({ image_path: imagePath, signed_path: signedPath, thumb_path: thumb });

    // The poster is done either way; without a preview the toggle says so,
    // and without a title it's "Untitled".
    const makePreview = async () => {
      const path = previewPath(id);
      try {
        await upload(path, await makeEinkPreview(signed), "image/png");
        return path;
      } catch (e) {
        console.error(`Generation ${id}: no e-ink preview:`, e);
        return null;
      }
    };
    const [preview] = await Promise.all([
      makePreview(),
      drawing.title ? null : nameDrawing(generation.drawing_id, poster),
    ]);
    await update({ status: "succeeded", preview_path: preview, finished_at: new Date().toISOString() });
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

// Titles an untitled drawing from its poster, unless someone named it while
// the poster was being made.
async function nameDrawing(drawingId: string, poster: Buffer) {
  try {
    const title = cleanSuggestedTitle(await getImageGenerator().suggestTitle(poster));
    if (!title) return;
    const { error } = await createAdminClient().from("drawings").update({ title }).eq("id", drawingId).is("title", null);
    if (error) throw error;
  } catch (e) {
    console.error(`Drawing ${drawingId}: no suggested title:`, e);
  }
}
