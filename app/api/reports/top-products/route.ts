import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ReportService } from "@/services/ReportService";
import { TopProductsQuerySchema, reportFiltersFrom } from "@/schemas/report.schema";

export const GET = withAuth(
  async (req) => {
    const sp = req.nextUrl.searchParams;
    const { from, to, limit } = TopProductsQuerySchema.parse({
      from: sp.get("from"),
      to: sp.get("to"),
      limit: sp.get("limit") ?? undefined,
    });
    const data = await ReportService.topProducts(supabaseAdmin, { from, to }, limit, reportFiltersFrom(sp));
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);
