import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { AddOrderItemsSchema } from "@/schemas/order.schema";
import { OrderService } from "@/services/OrderService";

type Ctx = { params: { id: string } };

/**
 * POST /api/orders/:id/add-items
 * Adds items to an existing unpaid order (sent_to_kitchen | payment_pending),
 * recomputes the bill, and sends the additions to the kitchen. All roles.
 */
export const POST = withAuth<Ctx>(async (req, _user, { params }) => {
  const supabase = createServerClient();
  const { items } = AddOrderItemsSchema.parse(await req.json());
  const data = await OrderService.addItems(supabase, params.id, items);
  return NextResponse.json({ data });
});
