import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { PaymentMethodService } from "@/services/PaymentMethodService";
import { UpdatePaymentMethodSchema } from "@/schemas/payment-method.schema";

type Ctx = { params: { id: string } };

export const PATCH = withAuth<Ctx>(
  async (req, _user, { params }) => {
    const supabase = createServerClient();
    const body = UpdatePaymentMethodSchema.parse(await req.json());
    const data = await PaymentMethodService.update(supabase, params.id, body);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);
