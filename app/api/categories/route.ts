import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { CategoryService } from "@/services/CategoryService";
import { CreateCategorySchema } from "@/schemas/category.schema";
import { parsePaginationParams } from "@/lib/utils/pagination";

export const GET = withAuth(async (req) => {
  const supabase = createServerClient();
  const sp = req.nextUrl.searchParams;

  // Backward compatible: paginate only when asked; else return the full array.
  if (sp.has("page") || sp.has("limit")) {
    const { page, limit } = parsePaginationParams(sp);
    const data = await CategoryService.listPaginated(supabase, page, limit);
    return NextResponse.json({ data });
  }

  const data = await CategoryService.list(supabase);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req) => {
    const supabase = createServerClient();
    const body = CreateCategorySchema.parse(await req.json());
    const data = await CategoryService.create(supabase, body);
    return NextResponse.json({ data }, { status: 201 });
  },
  { roles: ["admin"] }
);
