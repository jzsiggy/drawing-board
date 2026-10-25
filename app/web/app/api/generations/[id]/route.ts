// GET /api/generations/:id: status of a poster, with a link to it once done.

import { jsonError } from "@/lib/api";
import { STALE_AFTER_MS } from "@/lib/generate/run";
import { getDeviceId } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const IMAGE_URL_SECONDS = 60 * 60;

export async function GET(_request: Request, ctx: RouteContext<"/api/generations/[id]">) {
  const { id } = await ctx.params;
  if (!(await getDeviceId())) return jsonError(401, "This phone has no session yet. Reload the page.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("generations")
    .select("id, drawing_id, status, error, signed_path, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return jsonError(404, "That poster doesn't exist.");

  let { status, error: message } = data;
  const unfinished = status === "pending" || status === "running";
  if (unfinished && Date.now() - new Date(data.created_at).getTime() > STALE_AFTER_MS) {
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

  return Response.json({ id: data.id, drawingId: data.drawing_id, status, error: message, imageUrl });
}
