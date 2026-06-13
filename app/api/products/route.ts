import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { ProductService } from "@/services/ProductService";
import { CreateProductSchema } from "@/schemas/product.schema";
import { parsePaginationParams } from "@/lib/utils/pagination";

export const GET = withAuth(async (req) => {
  const supabase = createServerClient();
  const sp = req.nextUrl.searchParams;
  const isActive = sp.get("is_active");
  const filters = {
    categoryId: sp.get("category_id") ?? undefined,
    search: sp.get("search") ?? undefined,
    isActive: isActive === null ? undefined : isActive === "true",
    kitchenOnly: sp.get("kitchen_only") === "true",
  };

  // Backward compatible: only paginate when asked (page/limit). POS, /menu,
  // coupons etc. fetch the full array.
  if (sp.has("page") || sp.has("limit")) {
    const { page, limit } = parsePaginationParams(sp);
    const data = await ProductService.listPaginated(supabase, filters, page, limit);
    return NextResponse.json({ data });
  }

  const data = await ProductService.list(supabase, filters);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req) => {
    const supabase = createServerClient();
    const body = CreateProductSchema.parse(await req.json());
    const data = await ProductService.create(supabase, body);
    return NextResponse.json({ data }, { status: 201 });
  },
  { roles: ["admin"] }
);
