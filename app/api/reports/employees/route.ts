import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ReportService } from "@/services/ReportService";
import { DateRangeSchema } from "@/schemas/report.schema";

export const GET = withAuth(
  async (req) => {
    const sp = req.nextUrl.searchParams;
    const range = DateRangeSchema.parse({ from: sp.get("from"), to: sp.get("to") });
    const data = await ReportService.salesByEmployee(supabaseAdmin, range);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);
