import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { CategoryService } from "@/services/CategoryService";
import { CreateCategorySchema } from "@/schemas/category.schema";

export const GET = withAuth(async () => {
  const supabase = createServerClient();
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
