// Secret-key (service role) client: bypasses row-level security. Server code
// and scripts only; never import this from a client component.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

export function createAdminClient(): SupabaseClient<Database> {
  client ??= createClient<Database>(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
