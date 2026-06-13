import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { OrderService } from "@/services/OrderService";
import { UpdateOrderSchema } from "@/schemas/order.schema";

type Ctx = { params: { id: string } };

export const GET = withAuth<Ctx>(async (_req, _user, { params }) => {
  const supabase = createServerClient();
  const data = await OrderService.getById(supabase, params.id);
  return NextResponse.json({ data });
});

export const PATCH = withAuth<Ctx>(async (req, _user, { params }) => {
  const supabase = createServerClient();
  const body = UpdateOrderSchema.parse(await req.json());
  const data = await OrderService.update(supabase, params.id, body);
  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>(async (_req, _user, { params }) => {
  const supabase = createServerClient();
  await OrderService.remove(supabase, params.id);
  return NextResponse.json({ success: true });
});
