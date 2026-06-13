import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { SessionService } from "@/services/SessionService";
import { CloseSessionSchema } from "@/schemas/session.schema";

type Ctx = { params: { id: string } };

export const POST = withAuth<Ctx>(
  async (req, _user, { params }) => {
    const supabase = createServerClient();
    const { notes } = CloseSessionSchema.parse(await req.json().catch(() => ({})));
    const data = await SessionService.close(supabase, params.id, notes);
    return NextResponse.json({ data });
  },
  { roles: ["admin", "employee"] }
);
