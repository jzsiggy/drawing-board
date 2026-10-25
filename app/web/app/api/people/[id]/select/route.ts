// POST /api/people/:id/select: "this is me" from the picker. Anyone can pick
// anyone.

import { jsonError } from "@/lib/api";
import { getDeviceId, selectPerson } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, ctx: RouteContext<"/api/people/[id]/select">) {
  const { id } = await ctx.params;
  const deviceId = await getDeviceId();
  if (!deviceId) return jsonError(401, "This phone has no session yet. Reload the page.");

  const { data, error } = await createAdminClient().from("people").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return jsonError(404, "That person doesn't exist.");

  await selectPerson(deviceId, id);
  return new Response(null, { status: 204 });
}
