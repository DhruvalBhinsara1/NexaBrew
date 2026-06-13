import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { SessionService } from "@/services/SessionService";
import { OpenSessionSchema, SessionStatusFilter } from "@/schemas/session.schema";

// GET is all-roles: the POS terminal (employee) needs the active session on
// startup. RLS limits employees to open sessions; admin sees full history.
export const GET = withAuth(async (req) => {
  const supabase = createServerClient();
  const statusParam = req.nextUrl.searchParams.get("status");
  const status = statusParam
    ? SessionStatusFilter.parse(statusParam)
    : undefined;
  const data = await SessionService.list(supabase, status);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req, user) => {
    const supabase = createServerClient();
    const { opening_balance } = OpenSessionSchema.parse(await req.json());
    const data = await SessionService.open(supabase, user.id, opening_balance);
    return NextResponse.json({ data }, { status: 201 });
  },
  { roles: ["admin"] }
);
