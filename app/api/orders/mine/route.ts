import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { OrderService } from "@/services/OrderService";

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
