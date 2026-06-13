import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { OrderService } from "@/services/OrderService";
import { KitchenService } from "@/services/KitchenService";

/**
 * GET /api/orders/mine
 * Orders belonging to the logged-in customer (via customers.user_id link).
 * All authenticated roles; for staff this simply returns [] unless their
 * account is also linked to a CRM row.
 */
export const GET = withAuth(async (_req, user) => {
  const supabase = createServerClient();
  const data = await OrderService.listForCustomerUser(supabase, user.id);
  return NextResponse.json({ data });
});

const CreateMineSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("A valid product is required"),
        quantity: z.number().int().positive("Quantity must be greater than 0"),
      })
    )
    .min(1, "Add at least one item"),
  table_id: z.string().uuid().nullable().optional(),
  coupon_code: z.string().trim().min(1).optional(),
});

/**
 * POST /api/orders/mine
 * A customer places their own order from /menu: creates the order against the
 * current open session (resolved server-side), sends it to the kitchen, and
 * returns the full order. Payment (counter or online) is handled afterwards.
 */
export const POST = withAuth(async (req, user) => {
  const supabase = createServerClient();
  const body = CreateMineSchema.parse(await req.json());
  const order = await OrderService.createForCustomerUser(supabase, user.id, body);
  await KitchenService.sendToKitchen(supabase, order.id);
  const data = await OrderService.getById(supabase, order.id);
  return NextResponse.json({ data }, { status: 201 });
});
