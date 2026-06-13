import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { ProductWithCategory } from "@/types/domain.types";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/schemas/product.schema";
import { AppError } from "@/lib/utils/app-error";

type Supa = SupabaseClient<Database>;

const PRODUCT_SELECT = "*, category:categories(id, name, color)";

export interface ProductFilters {
  categoryId?: string;
  search?: string;
  isActive?: boolean;
  kitchenOnly?: boolean;
}

export const ProductService = {
  async list(supabase: Supa, filters: ProductFilters): Promise<ProductWithCategory[]> {
    let query = supabase.from("products").select(PRODUCT_SELECT).order("name");

    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (typeof filters.isActive === "boolean") {
      query = query.eq("is_active", filters.isActive);
    }
    if (filters.kitchenOnly) query = query.eq("is_kitchen_display", true);
    if (filters.search) query = query.ilike("name", `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, "PRODUCTS_LIST_FAILED", 500);
    return (data ?? []) as ProductWithCategory[];
  },

  async getById(supabase: Supa, id: string): Promise<ProductWithCategory> {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new AppError(error.message, "PRODUCT_FETCH_FAILED", 500);
    if (!data) throw new AppError("Product not found", "PRODUCT_NOT_FOUND", 404);
    return data as ProductWithCategory;
  },

  async create(supabase: Supa, input: CreateProductInput): Promise<ProductWithCategory> {
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: input.name,
        category_id: input.category_id,
        price: input.price,
        unit_of_measure: input.unit_of_measure,
        tax_rate: input.tax_rate,
        description: input.description ?? null,
        is_kitchen_display: input.is_kitchen_display,
      })
      .select(PRODUCT_SELECT)
      .single();
    if (error) throw new AppError(error.message, "PRODUCT_CREATE_FAILED", 400);
    return data as ProductWithCategory;
  },

  async update(
    supabase: Supa,
    id: string,
    input: UpdateProductInput
  ): Promise<ProductWithCategory> {
    const { data, error } = await supabase
      .from("products")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(PRODUCT_SELECT)
      .maybeSingle();
    if (error) throw new AppError(error.message, "PRODUCT_UPDATE_FAILED", 400);
    if (!data) throw new AppError("Product not found", "PRODUCT_NOT_FOUND", 404);
    return data as ProductWithCategory;
  },

  async remove(supabase: Supa, id: string): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw new AppError(error.message, "PRODUCT_DELETE_FAILED", 400);
  },
};
