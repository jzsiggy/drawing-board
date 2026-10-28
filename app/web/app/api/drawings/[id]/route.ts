// PATCH /api/drawings/:id { title }: renames a drawing, and so every poster
// made from it. A blank title clears it ("Untitled").

import { z } from "zod";

import { jsonError, readJson } from "@/lib/api";
import { posterTitleSchema } from "@/lib/posters";
import { getDeviceId } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ title: posterTitleSchema });

export async function PATCH(request: Request, ctx: RouteContext<"/api/drawings/[id]">) {
  const { id } = await ctx.params;
  if (!(await getDeviceId())) return jsonError(401, "This phone has no session yet. Reload the page.");
  if (!z.uuid().safeParse(id).success) return jsonError(404, "That drawing doesn't exist.");

  const body = await readJson(request, bodySchema);
  if ("error" in body) return body.error;

  const { data, error } = await createAdminClient()
    .from("drawings")
    .update({ title: body.data.title })
    .eq("id", id)
    .select("title")
    .maybeSingle();
  if (error) throw error;
  if (!data) return jsonError(404, "That drawing doesn't exist.");
  return Response.json({ title: data.title });
}
