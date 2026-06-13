import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { FloorService } from "@/services/FloorService";
import { UpdateTableSchema } from "@/schemas/floor.schema";

type Ctx = { params: { id: string } };

export const PATCH = withAuth<Ctx>(
  async (req, _user, { params }) => {
    const supabase = createServerClient();
    const body = UpdateTableSchema.parse(await req.json());
    const data = await FloorService.updateTable(supabase, params.id, body);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);
