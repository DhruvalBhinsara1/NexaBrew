import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { OrderService } from "@/services/OrderService";
import { ApplyCouponSchema } from "@/schemas/coupon.schema";

type Ctx = { params: { id: string } };

export const POST = withAuth<Ctx>(async (req, _user, { params }) => {
  const supabase = createServerClient();
  const { code } = ApplyCouponSchema.parse(await req.json());
  const data = await OrderService.applyCoupon(supabase, params.id, code);
  return NextResponse.json({ data });
});
