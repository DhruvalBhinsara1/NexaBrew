import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Browser-side Supabase client. Use in client components, hooks, and realtime
 * subscriptions. Reads the anon key (safe for the browser). Auth state is
 * persisted via the httpOnly session cookie managed by @supabase/ssr.
 */
export function createBrowserClient(): SupabaseClient<Database> {
  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
