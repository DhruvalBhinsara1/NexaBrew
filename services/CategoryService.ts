import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Category } from "@/types/domain.types";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/schemas/category.schema";
import { AppError } from "@/lib/utils/app-error";

type Supa = SupabaseClient<Database>;

export const CategoryService = {
  async list(supabase: Supa): Promise<Category[]> {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (error) throw new AppError(error.message, "CATEGORIES_LIST_FAILED", 500);
    return data ?? [];
  },

  async create(supabase: Supa, input: CreateCategoryInput): Promise<Category> {
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: input.name, color: input.color })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new AppError("A category with that name already exists", "CATEGORY_DUPLICATE", 409);
      }
      throw new AppError(error.message, "CATEGORY_CREATE_FAILED", 400);
    }
    return data;
  },

  async update(supabase: Supa, id: string, input: UpdateCategoryInput): Promise<Category> {
    const { data, error } = await supabase
      .from("categories")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        throw new AppError("A category with that name already exists", "CATEGORY_DUPLICATE", 409);
      }
      throw new AppError(error.message, "CATEGORY_UPDATE_FAILED", 400);
    }
    if (!data) throw new AppError("Category not found", "CATEGORY_NOT_FOUND", 404);
    return data;
  },

  async remove(supabase: Supa, id: string): Promise<void> {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new AppError(error.message, "CATEGORY_DELETE_FAILED", 400);
  },
};
