import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Service-role Supabase client. SERVER-ONLY — bypasses RLS.
 * Use exclusively for privileged operations such as creating employee accounts
 * via the Supabase Admin API (e.g. POST /api/users). Never import this in
 * client components or browser-accessible code.
 */
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
