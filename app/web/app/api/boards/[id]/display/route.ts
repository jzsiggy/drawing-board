// POST /api/boards/:id/display {"generationId"}: "Send to frame". Renders the
// signed poster for that frame's panel and makes it the frame's next image.

import { z } from "zod";

import { jsonError, readJson } from "@/lib/api";
import { sendImageToBoard } from "@/lib/frames/send";
import { listFrameStatuses } from "@/lib/frames/status";
import { getCurrentPerson, getDeviceId } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ generationId: z.uuid("generationId must be a poster ID") });

export async function POST(request: Request, ctx: RouteContext<"/api/boards/[id]/display">) {
  const { id: boardId } = await ctx.params;
  const deviceId = await getDeviceId();
  if (!deviceId) return jsonError(401, "This phone has no session yet. Reload the page.");
  const input = await readJson(request, bodySchema);
  if ("error" in input) return input.error;
  const { generationId } = input.data;

  const supabase = createAdminClient();
  const [{ data: board }, { data: generation }] = await Promise.all([
    supabase.from("boards").select("id").eq("id", boardId).maybeSingle(),
    supabase.from("generations").select("status, signed_path").eq("id", generationId).maybeSingle(),
  ]);
  if (!board) return jsonError(404, "That frame doesn't exist.");
  if (!generation) return jsonError(404, "That poster doesn't exist.");
  if (generation.status !== "succeeded" || !generation.signed_path) {
    return jsonError(409, "That poster isn't finished yet.");
  }

  const poster = await supabase.storage.from("generations").download(generation.signed_path);
  if (poster.error) throw poster.error;

  const person = await getCurrentPerson();
  await sendImageToBoard({
    boardId,
    image: Buffer.from(await poster.data.arrayBuffer()),
    sourcePath: `generations/${generation.signed_path}`,
    generationId,
    sentBy: person?.id,
    deviceId,
  });
  return Response.json({ frames: await listFrameStatuses(generationId) });
}
