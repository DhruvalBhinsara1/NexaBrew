import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { OrderService } from "@/services/OrderService";

type Ctx = { params: { id: string } };

const AssignTableSchema = z.object({
  table_id: z.string().uuid("A valid table is required"),
});

/**
 * POST /api/orders/:id/assign-table
 * Assigns an unoccupied table to an active, unpaid order that has none
 * (e.g. a bill sent to the kitchen before a table was chosen). All roles.
 */
export const POST = withAuth<Ctx>(async (req, _user, { params }) => {
  const supabase = createServerClient();
  const { table_id } = AssignTableSchema.parse(await req.json());
  const data = await OrderService.assignTable(supabase, params.id, table_id);
  return NextResponse.json({ data });
});
