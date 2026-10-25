// GET /api/boards?generation=<id>: every frame's status, and where that
// poster stands on each.

import { z } from "zod";

import { jsonError } from "@/lib/api";
import { listFrameStatuses } from "@/lib/frames/status";
import { getDeviceId } from "@/lib/session";

export async function GET(request: Request) {
  if (!(await getDeviceId())) return jsonError(401, "This phone has no session yet. Reload the page.");
  const generation = new URL(request.url).searchParams.get("generation");
  const id = generation ? z.uuid().safeParse(generation) : null;
  if (id && !id.success) return jsonError(400, "generation must be a poster ID.");
  return Response.json({ frames: await listFrameStatuses(id?.data) });
}
