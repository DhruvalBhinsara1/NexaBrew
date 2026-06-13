import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { SessionService } from "@/services/SessionService";

// Distinct users who have opened sessions — powers the "Filter by User" dropdown.
export const GET = withAuth(async () => {
  const supabase = createServerClient();
  const data = await SessionService.getDistinctUsers(supabase);
  return NextResponse.json({ data });
});
