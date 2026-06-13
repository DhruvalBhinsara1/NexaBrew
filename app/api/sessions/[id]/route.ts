import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { SessionService } from "@/services/SessionService";

type Ctx = { params: { id: string } };

export const GET = withAuth<Ctx>(async (_req, _user, { params }) => {
  const supabase = createServerClient();
  const data = await SessionService.getById(supabase, params.id);
  return NextResponse.json({ data });
});
