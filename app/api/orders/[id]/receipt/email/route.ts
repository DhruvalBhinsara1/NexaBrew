import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { SendReceiptSchema } from "@/schemas/payment.schema";
import { PaymentService } from "@/services/PaymentService";

type Ctx = { params: { id: string } };

export const POST = withAuth<Ctx>(async (req, _user, { params }) => {
  const supabase = createServerClient();
  const body = SendReceiptSchema.parse(await req.json().catch(() => ({})));
  const data = await PaymentService.sendReceipt(supabase, params.id, body.email);
  return NextResponse.json({ data });
});
