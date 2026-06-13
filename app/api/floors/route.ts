import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { FloorService } from "@/services/FloorService";
import { CreateFloorSchema } from "@/schemas/floor.schema";

export const GET = withAuth(async () => {
  const supabase = createServerClient();
  const data = await FloorService.listWithTables(supabase);
  return NextResponse.json({ data });
});

export const POST = withAuth(
  async (req) => {
    const supabase = createServerClient();
    const body = CreateFloorSchema.parse(await req.json());
    const data = await FloorService.createFloor(supabase, body);
    return NextResponse.json({ data }, { status: 201 });
  },
  { roles: ["admin"] }
);
