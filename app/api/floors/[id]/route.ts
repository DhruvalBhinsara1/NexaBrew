import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { FloorService } from "@/services/FloorService";
import { UpdateFloorSchema } from "@/schemas/floor.schema";

type Ctx = { params: { id: string } };

export const PATCH = withAuth<Ctx>(
  async (req, _user, { params }) => {
    const supabase = createServerClient();
    const body = UpdateFloorSchema.parse(await req.json());
    const data = await FloorService.updateFloor(supabase, params.id, body);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);

export const DELETE = withAuth<Ctx>(
  async (_req, _user, { params }) => {
    const supabase = createServerClient();
    await FloorService.deleteFloor(supabase, params.id);
    return NextResponse.json({ success: true });
  },
  { roles: ["admin"] }
);
