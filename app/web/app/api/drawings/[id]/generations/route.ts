// POST /api/drawings/:id/generations: make a new poster version of a drawing.
// Replies straight away with the generation's ID; the work continues after
// the response and the page polls GET /api/generations/:id.

import { after } from "next/server";

import { jsonError } from "@/lib/api";
import { createGeneration, runGeneration } from "@/lib/generate/run";
import { getDeviceId } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Covers the image model; after() runs within this limit.
export const maxDuration = 300;

export async function POST(_request: Request, ctx: RouteContext<"/api/drawings/[id]/generations">) {
  const { id: drawingId } = await ctx.params;
  if (!(await getDeviceId())) return jsonError(401, "This phone has no session yet. Reload the page.");

  const { data: drawing, error } = await createAdminClient()
    .from("drawings")
    .select("id")
    .eq("id", drawingId)
    .maybeSingle();
  if (error) throw error;
  if (!drawing) return jsonError(404, "That drawing doesn't exist.");

  const id = await createGeneration(drawingId);
  after(() => runGeneration(id));
  return Response.json({ id }, { status: 202 });
}
