// POST /api/people: "Add yourself". Creates a person owned by this phone and
// selects them.

import { jsonError, readJson } from "@/lib/api";
import { ensureDevice } from "@/lib/devices";
import { describePersonIssue, personInputSchema } from "@/lib/people";
import { getDeviceId, selectPerson } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const deviceId = await getDeviceId();
  if (!deviceId) return jsonError(401, "This phone has no session yet. Reload the page.");

  const input = await readJson(request, personInputSchema, describePersonIssue);
  if ("error" in input) return input.error;

  await ensureDevice(deviceId, request.headers.get("user-agent") ?? "");
  const { data, error } = await createAdminClient()
    .from("people")
    .insert({
      name: input.data.name,
      signature_strokes: input.data.signature,
      created_by_device_id: deviceId,
    })
    .select("id")
    .single();
  if (error) throw error;

  await selectPerson(deviceId, data.id);
  return Response.json({ id: data.id }, { status: 201 });
}
