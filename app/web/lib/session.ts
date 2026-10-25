// Who is asking: the phone (device) and the person it has picked.

import { cookies } from "next/headers";
import { connection } from "next/server";

import { PERSON_COOKIE } from "@/lib/cookies";
import { ensureDevice } from "@/lib/devices";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

const PERSON_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export type Person = Pick<Tables<"people">, "id" | "name" | "signature_strokes" | "created_by_device_id">;

// The phone's device ID (its anonymous user ID), or null if it has no session.
export async function getDeviceId(): Promise<string | null> {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

// The person this phone has picked, if they still exist.
export async function getCurrentPerson(): Promise<Person | null> {
  await connection();
  const id = (await cookies()).get(PERSON_COOKIE)?.value;
  if (!id) return null;
  const { data } = await createAdminClient()
    .from("people")
    .select("id, name, signature_strokes, created_by_device_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

// Remembers the choice on this phone (server-set, so Safari doesn't cap it at
// 7 days) and in the picker's "On this phone" list.
export async function selectPerson(deviceId: string, personId: string) {
  await ensureDevice(deviceId);
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const results = await Promise.all([
    supabase
      .from("device_people")
      .upsert({ device_id: deviceId, person_id: personId, last_selected_at: now }),
    supabase.from("people").update({ last_active_at: now }).eq("id", personId),
    supabase.from("devices").update({ last_seen_at: now }).eq("id", deviceId),
  ]);
  for (const { error } of results) if (error) throw error;

  (await cookies()).set(PERSON_COOKIE, personId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PERSON_COOKIE_MAX_AGE,
    path: "/",
  });
}
