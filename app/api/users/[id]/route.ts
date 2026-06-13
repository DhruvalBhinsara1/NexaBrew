import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { UserService } from "@/services/UserService";
import { UpdateUserSchema } from "@/schemas/user.schema";

type Ctx = { params: { id: string } };

export const GET = withAuth<Ctx>(
  async (_req, _user, { params }) => {
    const data = await UserService.getById(supabaseAdmin, params.id);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);

export const PATCH = withAuth<Ctx>(
  async (req, user, { params }) => {
    const body = UpdateUserSchema.parse(await req.json());
    const data = await UserService.update(supabaseAdmin, params.id, body, user.id);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);

export const DELETE = withAuth<Ctx>(
  async (_req, user, { params }) => {
    const data = await UserService.archive(supabaseAdmin, params.id, user.id);
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);
