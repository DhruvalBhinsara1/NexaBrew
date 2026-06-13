import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { ProcessPaymentSchema } from "@/schemas/payment.schema";
import { PaymentService } from "@/services/PaymentService";

type Ctx = { params: { id: string } };

export const POST = withAuth<Ctx>(async (req, _user, { params }) => {
  const supabase = createServerClient();
  const body = ProcessPaymentSchema.parse(await req.json());
  const data = await PaymentService.process(supabase, params.id, body);
  return NextResponse.json({ data }, { status: 201 });
});
