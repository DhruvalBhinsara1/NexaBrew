import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { PaymentMethodService } from "@/services/PaymentMethodService";

export const GET = withAuth(async () => {
  const supabase = createServerClient();
  const data = await PaymentMethodService.list(supabase);
  return NextResponse.json({ data });
});
