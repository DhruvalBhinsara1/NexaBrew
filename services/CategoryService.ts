import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Category } from "@/types/domain.types";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/schemas/category.schema";
import type { PaginatedResponse } from "@/types/pagination.types";
import { AppError } from "@/lib/utils/app-error";
import {
  calculateOffset,
  calculatePaginationMeta,
  DEFAULT_PAGE_SIZE,
} from "@/lib/utils/pagination";

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

  async listPaginated(
    supabase: Supa,
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE
  ): Promise<PaginatedResponse<Category>> {
    // Get total count
    const { count, error: countError } = await supabase
      .from("categories")
      .select("id", { count: "exact" });

    if (countError) throw new AppError(countError.message, "CATEGORIES_COUNT_FAILED", 500);

    // Get paginated data
    const offset = calculateOffset(page, limit);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name")
      .range(offset, offset + limit - 1);

    if (error) throw new AppError(error.message, "CATEGORIES_LIST_FAILED", 500);

    const total = count ?? 0;
    const paginationMeta = calculatePaginationMeta(page, limit, total);

    return {
      data: data ?? [],
      pagination: paginationMeta,
    };
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
