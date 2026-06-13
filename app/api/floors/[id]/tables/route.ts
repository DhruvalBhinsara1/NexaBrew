import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { createServerClient } from "@/lib/supabase/server";
import { FloorService } from "@/services/FloorService";
import { CreateTableSchema } from "@/schemas/floor.schema";

type Ctx = { params: { id: string } };

export const POST = withAuth<Ctx>(
  async (req, _user, { params }) => {
    const supabase = createServerClient();
    const body = CreateTableSchema.parse(await req.json());
    const data = await FloorService.addTable(supabase, params.id, body);
    return NextResponse.json({ data }, { status: 201 });
  },
  { roles: ["admin"] }
);
