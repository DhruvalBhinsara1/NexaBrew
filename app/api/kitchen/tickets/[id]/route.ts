import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { handleError } from "@/lib/utils/handleError";
import { KitchenService } from "@/services/KitchenService";
import { AdvanceTicketStatusSchema } from "@/schemas/kitchen.schema";

type Ctx = { params: { id: string } };

/**
 * PATCH /api/kitchen/tickets/:id
 * Advances a ticket's status forward-only: to_cook → preparing → completed.
 * When completed the linked order is moved to payment_pending (DECISION-005).
 *
 * PUBLIC route — no withAuth. Uses the service-role admin client so the KDS
 * display screen can update ticket status without a logged-in session
 * (DECISION-009). RLS is bypassed via service-role key.
 */
export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const body = AdvanceTicketStatusSchema.parse(await req.json());
    const data = await KitchenService.advanceTicketStatus(supabaseAdmin, params.id, body.status);
    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err);
  }
}
