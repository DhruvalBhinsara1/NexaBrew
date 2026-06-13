import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { OrderService } from "@/services/OrderService";
import { CreateOrderSchema, OrderStatusFilter } from "@/schemas/order.schema";
import { parsePaginationParams } from "@/lib/utils/pagination";

export const GET = withAuth(async (req) => {
  const supabase = createServerClient();
  const sp = req.nextUrl.searchParams;
  const statusParam = sp.get("status");
  const status = statusParam ? OrderStatusFilter.parse(statusParam) : undefined;
  const filters = {
    sessionId: sp.get("session_id") ?? undefined,
    status,
    tableId: sp.get("table_id") ?? undefined,
    search: sp.get("search") ?? undefined,
  };

  if (sp.has("page") || sp.has("limit")) {
    const { page, limit } = parsePaginationParams(sp);
    const data = await OrderService.listPaginated(supabase, filters, page, limit);
    return NextResponse.json({ data });
  }

  const data = await OrderService.list(supabase, filters);
  return NextResponse.json({ data });
});

export const POST = withAuth(async (req, user) => {
  const supabase = createServerClient();
  const body = CreateOrderSchema.parse(await req.json());
  const data = await OrderService.create(supabase, body, user.id);
  return NextResponse.json({ data: data.order }, { status: data.created ? 201 : 200 });
});
