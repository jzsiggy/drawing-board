// GET /api/generations/:id: status of a poster, with a link to it once done,
// and the drawing's title (which the model may have just suggested).

import { jsonError } from "@/lib/api";
import { isStale } from "@/lib/generate/run";
import { getDeviceId } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const IMAGE_URL_SECONDS = 60 * 60;

export async function GET(_request: Request, ctx: RouteContext<"/api/generations/[id]">) {
  const { id } = await ctx.params;
  if (!(await getDeviceId())) return jsonError(401, "This phone has no session yet. Reload the page.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("generations")
    .select("id, drawing_id, status, error, image_path, signed_path, created_at, drawing:drawings(title)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return jsonError(404, "That poster doesn't exist.");

  let { status, error: message } = data;
  if (isStale(data)) {
    status = "failed";
    message = "Making the poster took too long. Try again.";
    await supabase
      .from("generations")
      .update({ status, error: message, finished_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["pending", "running"]);
  }

  let imageUrl: string | null = null;
  if (status === "succeeded" && data.signed_path) {
    const signed = await supabase.storage.from("generations").createSignedUrl(data.signed_path, IMAGE_URL_SECONDS);
    if (signed.error) throw signed.error;
    imageUrl = signed.data.signedUrl;
  }

  // Where an unfinished poster is: waiting to start, being painted by the
  // model, or being fitted to the panel's inks.
  const stage = status === "pending" ? "queued" : status === "running" ? (data.image_path ? "fitting" : "painting") : null;

  return Response.json({
    id: data.id,
    drawingId: data.drawing_id,
    title: data.drawing?.title ?? null,
    status,
    stage,
    error: message,
    imageUrl,
  });
}
