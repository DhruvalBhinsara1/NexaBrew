import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { User } from "@/types/domain.types";
import type { CreateUserInput, UpdateUserInput } from "@/schemas/user.schema";
import { AppError } from "@/lib/utils/app-error";

type Supa = SupabaseClient<Database>;

export interface UserFilters {
  role?: "admin" | "employee" | "customer";
  isArchived?: boolean;
  search?: string;
}

function mapAuthError(error: { message: string; status?: number }, code: string): AppError {
  const message = error.message;
  const lower = message.toLowerCase();
  if (
    error.status === 422 ||
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("already exists")
  ) {
    return new AppError(message, "USER_ALREADY_EXISTS", 409);
  }
  if (error.status === 404) return new AppError("User not found", "USER_NOT_FOUND", 404);
  return new AppError(message, code, 400);
}

function mapProfileError(error: { message: string; code?: string }, code: string): AppError {
  if (error.code === "23505") {
    return new AppError("A user with this email already exists", "USER_ALREADY_EXISTS", 409);
  }
  return new AppError(error.message, code, 400);
}

export const UserService = {
  async list(supabase: Supa, filters: UserFilters = {}): Promise<User[]> {
    let query = supabase.from("users").select("*").order("created_at", { ascending: false });

    if (filters.role) query = query.eq("role", filters.role);
    if (typeof filters.isArchived === "boolean") {
      query = query.eq("is_archived", filters.isArchived);
    }
    if (filters.search) {
      const search = filters.search.replace(/[%*]/g, "");
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new AppError(error.message, "USERS_LIST_FAILED", 500);
    return (data ?? []) as User[];
  },

  async getById(supabase: Supa, id: string): Promise<User> {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    if (error) throw new AppError(error.message, "USER_FETCH_FAILED", 500);
    if (!data) throw new AppError("User not found", "USER_NOT_FOUND", 404);
    return data as User;
  },

  async create(supabase: Supa, input: CreateUserInput): Promise<User> {
    const { data, error } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name, role: input.role },
    });
    if (error) throw mapAuthError(error, "USER_CREATE_FAILED");
    if (!data.user) throw new AppError("User was not created", "USER_CREATE_FAILED", 400);

    const { error: profileError } = await supabase.from("users").upsert(
      {
        id: data.user.id,
        email: input.email,
        name: input.name,
        role: input.role,
        is_archived: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      await supabase.auth.admin.deleteUser(data.user.id);
      throw mapProfileError(profileError, "USER_PROFILE_CREATE_FAILED");
    }

    return this.getById(supabase, data.user.id);
  },

  async update(
    supabase: Supa,
    id: string,
    input: UpdateUserInput,
    actorId: string
  ): Promise<User> {
    const existing = await this.getById(supabase, id);
    if (id === actorId && input.is_archived === true) {
      throw new AppError("You cannot archive your own account", "CANNOT_ARCHIVE_SELF", 409);
    }
    if (id === actorId && input.role && input.role !== "admin") {
      throw new AppError("You cannot remove your own admin role", "CANNOT_DEMOTE_SELF", 409);
    }

    const userMetadata: Record<string, string> = {};
    if (input.name) userMetadata.name = input.name;
    if (input.role) userMetadata.role = input.role;

    const authUpdate: Parameters<typeof supabase.auth.admin.updateUserById>[1] = {};
    if (input.email) authUpdate.email = input.email;
    if (input.password) authUpdate.password = input.password;
    if (Object.keys(userMetadata).length > 0) authUpdate.user_metadata = userMetadata;
    if (typeof input.is_archived === "boolean") {
      authUpdate.ban_duration = input.is_archived ? "876000h" : "none";
    }

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await supabase.auth.admin.updateUserById(id, authUpdate);
      if (error) throw mapAuthError(error, "USER_AUTH_UPDATE_FAILED");
    }

    const profileUpdate: Database["public"]["Tables"]["users"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (input.name) profileUpdate.name = input.name;
    if (input.email) profileUpdate.email = input.email;
    if (input.role) profileUpdate.role = input.role;
    if (typeof input.is_archived === "boolean") {
      profileUpdate.is_archived = input.is_archived;
    }

    const { data, error } = await supabase
      .from("users")
      .update(profileUpdate)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) throw mapProfileError(error, "USER_UPDATE_FAILED");
    if (!data) throw new AppError("User not found", "USER_NOT_FOUND", 404);
    return data as User;
  },

  async archive(supabase: Supa, id: string, actorId: string): Promise<User> {
    return this.update(supabase, id, { is_archived: true }, actorId);
  },
};
