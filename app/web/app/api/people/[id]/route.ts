// PATCH /api/people/:id: edit a name or signature, only from the phone that
// created that person.

import { jsonError, readJson } from "@/lib/api";
import { describePersonIssue, personInputSchema } from "@/lib/people";
import { getDeviceId } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, ctx: RouteContext<"/api/people/[id]">) {
  const { id } = await ctx.params;
  const deviceId = await getDeviceId();
  if (!deviceId) return jsonError(401, "This phone has no session yet. Reload the page.");

  const supabase = createAdminClient();
  const { data: person, error: findError } = await supabase
    .from("people")
    .select("created_by_device_id")
    .eq("id", id)
    .maybeSingle();
  if (findError) throw findError;
  if (!person) return jsonError(404, "That person doesn't exist.");
  if (person.created_by_device_id !== deviceId) {
    return jsonError(403, "Only the phone that added this person can edit them.");
  }

  const input = await readJson(request, personInputSchema, describePersonIssue);
  if ("error" in input) return input.error;

  const { error } = await supabase
    .from("people")
    .update({ name: input.data.name, signature_strokes: input.data.signature })
    .eq("id", id);
  if (error) throw error;
  return new Response(null, { status: 204 });
}
