import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { handleError } from "@/lib/utils/handleError";
import { KitchenService } from "@/services/KitchenService";

type Ctx = { params: { id: string; itemId: string } };

/**
 * PATCH /api/kitchen/tickets/:id/items/:itemId
 * Marks a single kitchen ticket item as completed (is_completed = true).
 *
 * PUBLIC route — no withAuth. Uses the service-role admin client so the KDS
 * display can tick off individual items without a logged-in session
 * (DECISION-009). Body is intentionally empty; the only mutation is the flag.
 */
export async function PATCH(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  try {
    const data = await KitchenService.completeTicketItem(supabaseAdmin, params.id, params.itemId);
    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err);
  }
}
