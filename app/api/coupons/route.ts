import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { DiscountService } from "@/services/DiscountService";
import { CreateCouponSchema } from "@/schemas/coupon.schema";

export const GET = withAuth(async (req) => {
  const supabase = createServerClient();
  const activeParam = req.nextUrl.searchParams.get("is_active");
  const isActive = activeParam === null ? undefined : activeParam === "true";
  const data = await DiscountService.listCoupons(supabase, isActive);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req) => {
    const supabase = createServerClient();
    const body = CreateCouponSchema.parse(await req.json());
    const data = await DiscountService.createCoupon(supabase, body);
    return NextResponse.json({ data }, { status: 201 });
  },
  { roles: ["admin"] }
);
