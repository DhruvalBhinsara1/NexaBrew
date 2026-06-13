import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { UserService } from "@/services/UserService";
import {
  CreateUserSchema,
  UserArchivedFilterSchema,
  UserRoleSchema,
} from "@/schemas/user.schema";

export const GET = withAuth(
  async (req) => {
    const sp = req.nextUrl.searchParams;
    const roleParam = sp.get("role");
    const archivedParam = sp.get("is_archived");
    const data = await UserService.list(supabaseAdmin, {
      role: roleParam ? UserRoleSchema.parse(roleParam) : undefined,
      isArchived: archivedParam
        ? UserArchivedFilterSchema.parse(archivedParam) === "true"
        : undefined,
      search: sp.get("search") ?? undefined,
    });
    return NextResponse.json({ data });
  },
  { roles: ["admin"] }
);

export const POST = withAuth(
  async (req) => {
    const body = CreateUserSchema.parse(await req.json());
    const data = await UserService.create(supabaseAdmin, body);
    return NextResponse.json({ data }, { status: 201 });
  },
  { roles: ["admin"] }
);
