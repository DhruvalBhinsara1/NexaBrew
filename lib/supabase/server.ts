import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

/**
 * Server-side Supabase client for route handlers and server components.
 * Reads/writes the session cookie via next/headers. Uses the anon key — RLS
 * policies enforce data access based on the authenticated user.
 */
export function createServerClient(): SupabaseClient<Database> {
  const cookieStore = cookies();

  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `set` throws when called from a Server Component. Safe to ignore:
            // middleware refreshes the session cookie on every request.
          }
        },
      },
    }
  );
}
