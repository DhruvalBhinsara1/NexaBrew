import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { DiscountService } from "@/services/DiscountService";
import { UpdateCouponSchema } from "@/schemas/coupon.schema";

type Ctx = { params: { id: string } };

export const PATCH = withAuth<Ctx>(
  async (req, _user, { params }) => {
    const supabase = createServerClient();
    const body = UpdateCouponSchema.parse(await req.json());
    const data = await DiscountService.updateCoupon(supabase, params.id, body);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);

export const DELETE = withAuth<Ctx>(
  async (_req, _user, { params }) => {
    const supabase = createServerClient();
    await DiscountService.removeCoupon(supabase, params.id);
    return NextResponse.json({ success: true });
  },
  { roles: ["admin"] }
);
