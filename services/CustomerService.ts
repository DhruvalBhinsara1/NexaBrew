import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Customer } from "@/types/domain.types";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/schemas/customer.schema";
import { AppError } from "@/lib/utils/app-error";

type Supa = SupabaseClient<Database>;

function mapDbError(error: { message: string; code?: string }, fallbackCode: string): AppError {
  if (error.code === "23505") {
    return new AppError("A customer with this email already exists", "CUSTOMER_DUPLICATE_EMAIL", 409);
  }
  return new AppError(error.message, fallbackCode, 400);
}

export interface CustomerFilters {
  search?: string;
}

export const CustomerService = {
  async list(supabase: Supa, filters: CustomerFilters = {}): Promise<Customer[]> {
    let query = supabase.from("customers").select("*").order("name", { ascending: true });

    if (filters.search) {
      const s = filters.search.replace(/[%*]/g, "");
      query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    const { data, error } = await query;
    if (error) throw new AppError(error.message, "CUSTOMERS_LIST_FAILED", 500);
    return (data ?? []) as Customer[];
  },

  async getById(supabase: Supa, id: string): Promise<Customer> {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new AppError(error.message, "CUSTOMER_FETCH_FAILED", 500);
    if (!data) throw new AppError("Customer not found", "CUSTOMER_NOT_FOUND", 404);
    return data as Customer;
  },

  async create(supabase: Supa, input: CreateCustomerInput): Promise<Customer> {
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .maybeSingle();

    if (error) throw mapDbError(error, "CUSTOMER_CREATE_FAILED");
    if (!data) throw new AppError("Customer was not created", "CUSTOMER_CREATE_FAILED", 500);
    return data as Customer;
  },

  async update(supabase: Supa, id: string, input: UpdateCustomerInput): Promise<Customer> {
    // Verify it exists
    await this.getById(supabase, id);

    const patch: Database["public"]["Tables"]["customers"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) patch.name = input.name;
    if ("email" in input) patch.email = input.email ?? null;
    if ("phone" in input) patch.phone = input.phone ?? null;

    const { data, error } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw mapDbError(error, "CUSTOMER_UPDATE_FAILED");
    if (!data) throw new AppError("Customer not found", "CUSTOMER_NOT_FOUND", 404);
    return data as Customer;
  },

  async remove(supabase: Supa, id: string): Promise<{ id: string }> {
    await this.getById(supabase, id);

    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        throw new AppError(
          "Cannot delete a customer who has associated orders",
          "CUSTOMER_HAS_ORDERS",
          409
        );
      }
      throw new AppError(error.message, "CUSTOMER_DELETE_FAILED", 500);
    }
    return { id };
  },
};
