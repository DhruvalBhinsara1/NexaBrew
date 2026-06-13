import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { ProductService } from "@/services/ProductService";
import { UpdateProductSchema } from "@/schemas/product.schema";

type Ctx = { params: { id: string } };

export const PATCH = withAuth<Ctx>(
  async (req, _user, { params }) => {
    const supabase = createServerClient();
    const body = UpdateProductSchema.parse(await req.json());
    const data = await ProductService.update(supabase, params.id, body);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);

export const DELETE = withAuth<Ctx>(
  async (_req, _user, { params }) => {
    const supabase = createServerClient();
    await ProductService.remove(supabase, params.id);
    return NextResponse.json({ success: true });
  },
  { roles: ["admin"] }
);
