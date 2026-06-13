import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { CategoryService } from "@/services/CategoryService";
import { UpdateCategorySchema } from "@/schemas/category.schema";

type Ctx = { params: { id: string } };

export const PATCH = withAuth<Ctx>(
  async (req, _user, { params }) => {
    const supabase = createServerClient();
    const body = UpdateCategorySchema.parse(await req.json());
    const data = await CategoryService.update(supabase, params.id, body);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);

export const DELETE = withAuth<Ctx>(
  async (_req, _user, { params }) => {
    const supabase = createServerClient();
    await CategoryService.remove(supabase, params.id);
    return NextResponse.json({ success: true });
  },
  { roles: ["admin"] }
);
