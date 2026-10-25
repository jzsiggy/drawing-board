// The devices table: one row per phone browser, keyed by its anonymous user ID.

import { createAdminClient } from "@/lib/supabase/admin";

// Creates the phone's row if it doesn't exist yet. Safe to call repeatedly.
export async function ensureDevice(id: string, userAgent = "") {
  const { error } = await createAdminClient()
    .from("devices")
    .upsert({ id, label: deviceLabel(userAgent) }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

// "iPhone · Safari": enough for a person to recognise their phone later.
export function deviceLabel(ua: string): string {
  const device =
    [/iPhone/, /iPad/, /Android/, /Macintosh/, /Windows/, /Linux/]
      .map((re) => ua.match(re)?.[0])
      .find(Boolean) ?? "Unknown device";
  const browsers: [string, RegExp][] = [
    ["Edge", /EdgiOS|Edg\//],
    ["Firefox", /FxiOS|Firefox\//],
    ["Chrome", /CriOS|Chrome\//],
    ["Safari", /Safari\//],
  ];
  const browser = browsers.find(([, re]) => re.test(ua))?.[0] ?? "browser";
  return `${device === "Macintosh" ? "Mac" : device} · ${browser}`;
}
