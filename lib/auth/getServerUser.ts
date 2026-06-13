import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/utils/app-error";

export type UserRole = "admin" | "employee" | "customer" | "kitchen";

export interface AuthUser extends User {
  role: UserRole;
}

type UserProfile = { role: UserRole; is_archived: boolean };

/**
 * Validates the session cookie and returns the authenticated user enriched with
 * their role from public.users. Throws AppError (caught by handleError) when the
 * request is unauthenticated or the account is archived/missing.
 *
 * Used by withAuth() in every protected route handler.
 */
export async function getServerUser(): Promise<AuthUser> {
  const supabase = createServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AppError("Unauthenticated", "UNAUTHORIZED", 401);
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, is_archived")
    .eq("id", user.id)
    .maybeSingle();

  // Cast: the placeholder Database type is loose until Phase 1.6 regenerates
  // strict types; the select shape is guaranteed by the query above.
  const typedProfile = profile as UserProfile | null;

  if (!typedProfile || typedProfile.is_archived) {
    throw new AppError("Account inactive or not found", "ACCOUNT_INACTIVE", 403);
  }

  return { ...user, role: typedProfile.role };
}
