import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { ProductService } from "@/services/ProductService";
import { CreateProductSchema } from "@/schemas/product.schema";

export const GET = withAuth(async (req) => {
  const supabase = createServerClient();
  const sp = req.nextUrl.searchParams;
  const isActive = sp.get("is_active");

  const data = await ProductService.list(supabase, {
    categoryId: sp.get("category_id") ?? undefined,
    search: sp.get("search") ?? undefined,
    isActive: isActive === null ? undefined : isActive === "true",
    kitchenOnly: sp.get("kitchen_only") === "true",
  });
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
