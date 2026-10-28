// POST /api/drawings/:id/generations: make a new poster version of a drawing.
// Replies straight away with the generation's ID; the work continues after
// the response and the page polls GET /api/generations/:id. An optional
// { title } names the drawing; without one the title stays as it was.

import { after } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api";
import { createGeneration, runGeneration } from "@/lib/generate/run";
import { posterTitleSchema } from "@/lib/posters";
import { getDeviceId } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Covers the image model; after() runs within this limit.
export const maxDuration = 300;

const bodySchema = z.object({ title: posterTitleSchema.optional() }).optional();

export async function POST(request: Request, ctx: RouteContext<"/api/drawings/[id]/generations">) {
  const { id: drawingId } = await ctx.params;
  if (!(await getDeviceId())) return jsonError(401, "This phone has no session yet. Reload the page.");

  const body = bodySchema.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? "Invalid request");

  const supabase = createAdminClient();
  const { data: drawing, error } = await supabase
    .from("drawings")
    .select("id")
    .eq("id", drawingId)
    .maybeSingle();
  if (error) throw error;
  if (!drawing) return jsonError(404, "That drawing doesn't exist.");
  if (body.data?.title !== undefined) {
    const saved = await supabase.from("drawings").update({ title: body.data.title }).eq("id", drawingId);
    if (saved.error) throw saved.error;
  }

  const id = await createGeneration(drawingId);
  after(() => runGeneration(id));
  return Response.json({ id }, { status: 202 });
}
