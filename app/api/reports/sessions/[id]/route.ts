import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ReportService } from "@/services/ReportService";

type Ctx = { params: { id: string } };

export const GET = withAuth<Ctx>(
  async (_req, _user, { params }) => {
    const data = await ReportService.sessionSummary(supabaseAdmin, params.id);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);
