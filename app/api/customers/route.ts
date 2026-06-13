import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { CustomerService } from "@/services/CustomerService";
import { CreateCustomerSchema } from "@/schemas/customer.schema";

export const GET = withAuth(async (req) => {
  const supabase = createServerClient();
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const data = await CustomerService.list(supabase, { search });
  return NextResponse.json({ data });
});

export const POST = withAuth(async (req) => {
  const supabase = createServerClient();
  const body = CreateCustomerSchema.parse(await req.json());
  const data = await CustomerService.create(supabase, body);
  return NextResponse.json({ data }, { status: 201 });
});
