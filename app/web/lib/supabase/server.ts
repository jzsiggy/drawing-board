// Supabase client acting as the phone that made the request (its anonymous
// session from the cookies), so row-level security applies. For server
// components and route handlers; create one per request.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { env } from "@/lib/env";
import type { Database } from "./database.types";

export async function createSessionClient() {
  // Session checks compare token expiry with the clock, so never prerender.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        // Server components can't set cookies; the proxy keeps the session
        // fresh, so it's safe to skip here.
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
}
