// GET /api/images/sketch/:drawingId, and /api/images/{poster,thumb,preview}/
// :generationId: stable image addresses for <img> tags. "preview" is the
// poster dithered to the panel's inks.
// Each redirects to a fresh short-lived signed Storage link, so pages that
// stay open (or stay alive in the background) never hold an expired one.

import { jsonError } from "@/lib/api";
import { getDeviceId } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_SECONDS = 60 * 60;
// Less than the signed link's lifetime, so a cached redirect still works.
const CACHE_SECONDS = 30 * 60;

export async function GET(_request: Request, ctx: RouteContext<"/api/images/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  if (!(await getDeviceId())) return jsonError(401, "This phone has no session yet. Reload the page.");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(404, "No such image.");

  const supabase = createAdminClient();
  let bucket: "sketches" | "generations";
  let path: string | null | undefined;
  if (kind === "sketch") {
    bucket = "sketches";
    path = (await supabase.from("drawings").select("sketch_path").eq("id", id).maybeSingle()).data?.sketch_path;
  } else if (kind === "poster" || kind === "thumb" || kind === "preview") {
    bucket = "generations";
    const { data } = await supabase
      .from("generations")
      .select("signed_path, thumb_path, preview_path")
      .eq("id", id)
      .maybeSingle();
    // Posters made before thumbnails existed fall back to the full image.
    path = { poster: data?.signed_path, thumb: data?.thumb_path ?? data?.signed_path, preview: data?.preview_path }[kind];
  } else {
    return jsonError(404, "No such image.");
  }
  if (!path) return jsonError(404, "No such image.");

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_SECONDS);
  if (error) throw error;
  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": `private, max-age=${CACHE_SECONDS}` },
  });
}
