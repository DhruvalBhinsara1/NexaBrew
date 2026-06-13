import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { KitchenService } from "@/services/KitchenService";
import { KitchenTicketStatusFilter } from "@/schemas/kitchen.schema";

/**
 * GET /api/kitchen/tickets
 * Returns all kitchen tickets with their items.
 * Optional query params: ?status=to_cook|preparing|completed  ?order_id=<uuid>
 * All authenticated roles.
 */
export const GET = withAuth(async (req) => {
  const supabase = createServerClient();
  const sp = req.nextUrl.searchParams;

  const statusParam = sp.get("status");
  const status = statusParam ? KitchenTicketStatusFilter.parse(statusParam) : undefined;
  const orderId = sp.get("order_id") ?? undefined;

  const data = await KitchenService.listTickets(supabase, { status, orderId });
  return NextResponse.json({ data });
});
