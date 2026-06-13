import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { KitchenService } from "@/services/KitchenService";

type Ctx = { params: { id: string } };

export const POST = withAuth<Ctx>(async (_req, _user, { params }) => {
  const supabase = createServerClient();
  const data = await KitchenService.sendToKitchen(supabase, params.id);
  return NextResponse.json({ data });
});
