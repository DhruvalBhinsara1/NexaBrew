import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { OrderService } from "@/services/OrderService";

type Ctx = { params: { id: string } };

/**
 * POST /api/orders/:id/cancel
 * Cancels a draft or sent_to_kitchen order and frees its table.
 * All roles (the POS operator who took the order can cancel it).
 */
export const POST = withAuth<Ctx>(async (_req, _user, { params }) => {
  const supabase = createServerClient();
  const data = await OrderService.cancel(supabase, params.id);
  return NextResponse.json({ data });
});
