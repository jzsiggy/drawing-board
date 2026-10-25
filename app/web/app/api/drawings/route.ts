// POST /api/drawings: submit a drawing (multipart: "strokes" JSON, "sketch"
// PNG, optional "parent_drawing_id"), credited to the person this phone picked.

import { z } from "zod";

import { jsonError } from "@/lib/api";
import { getCurrentPerson, getDeviceId } from "@/lib/session";
import { drawingDocSchema } from "@/lib/strokes";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_SKETCH_BYTES = 4 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function POST(request: Request) {
  const deviceId = await getDeviceId();
  if (!deviceId) return jsonError(401, "This phone has no session yet. Reload the page.");
  const person = await getCurrentPerson();
  if (!person) return jsonError(409, "Pick who's drawing first.");

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError(400, "Expected a multipart form.");

  let strokesJson: unknown;
  try {
    strokesJson = JSON.parse(String(form.get("strokes") ?? ""));
  } catch {
    return jsonError(400, "Strokes are not valid JSON.");
  }
  const strokes = drawingDocSchema.safeParse(strokesJson);
  if (!strokes.success) return jsonError(400, "The drawing is empty or malformed.");

  const sketch = form.get("sketch");
  if (!(sketch instanceof File) || sketch.size === 0) return jsonError(400, "The sketch image is missing.");
  if (sketch.size > MAX_SKETCH_BYTES) return jsonError(413, "The sketch image is too large.");
  const sketchBytes = new Uint8Array(await sketch.arrayBuffer());
  if (!PNG_SIGNATURE.every((b, i) => sketchBytes[i] === b)) return jsonError(400, "The sketch must be a PNG.");

  const parent = z.uuid().optional().safeParse(form.get("parent_drawing_id") || undefined);
  if (!parent.success) return jsonError(400, "parent_drawing_id must be a drawing ID.");

  const supabase = createAdminClient();
  const id = crypto.randomUUID();
  const sketchPath = `${id}.png`;
  const upload = await supabase.storage
    .from("sketches")
    .upload(sketchPath, sketchBytes, { contentType: "image/png" });
  if (upload.error) throw upload.error;

  const { error } = await supabase.from("drawings").insert({
    id,
    artist_id: person.id,
    device_id: deviceId,
    strokes: strokes.data,
    sketch_path: sketchPath,
    parent_drawing_id: parent.data ?? null,
  });
  if (error) {
    await supabase.storage.from("sketches").remove([sketchPath]);
    throw error;
  }
  return Response.json({ id }, { status: 201 });
}
