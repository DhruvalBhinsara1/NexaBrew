import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { CustomerService } from "@/services/CustomerService";
import { UpdateCustomerSchema } from "@/schemas/customer.schema";

type Ctx = { params: { id: string } };

export const GET = withAuth<Ctx>(async (_req, _user, { params }) => {
  const supabase = createServerClient();
  const data = await CustomerService.getById(supabase, params.id);
  return NextResponse.json({ data });
});

export const PATCH = withAuth<Ctx>(async (req, _user, { params }) => {
  const supabase = createServerClient();
  const body = UpdateCustomerSchema.parse(await req.json());
  const data = await CustomerService.update(supabase, params.id, body);
  return NextResponse.json({ data });
});

export const DELETE = withAuth<Ctx>(async (_req, _user, { params }) => {
  const supabase = createServerClient();
  const data = await CustomerService.remove(supabase, params.id);
  return NextResponse.json({ data });
});
