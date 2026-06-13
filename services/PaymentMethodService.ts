import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { PaymentMethod } from "@/types/domain.types";
import type { UpdatePaymentMethodInput } from "@/schemas/payment-method.schema";
import { AppError } from "@/lib/utils/app-error";

type Supa = SupabaseClient<Database>;

export const PaymentMethodService = {
  async list(supabase: Supa): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .order("type");
    if (error) throw new AppError(error.message, "PAYMENT_METHODS_LIST_FAILED", 500);
    return data ?? [];
  },

  async update(
    supabase: Supa,
    id: string,
    input: UpdatePaymentMethodInput
  ): Promise<PaymentMethod> {
    const { data: existing, error: fetchError } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw new AppError(fetchError.message, "PAYMENT_METHOD_FETCH_FAILED", 500);
    if (!existing) throw new AppError("Payment method not found", "PAYMENT_METHOD_NOT_FOUND", 404);

    const nextEnabled = input.is_enabled ?? existing.is_enabled;
    const nextUpiId = input.upi_id !== undefined ? input.upi_id : existing.upi_id;

    // Business rule: a UPI method enabled without a UPI ID is invalid.
    if (existing.type === "upi" && nextEnabled && !nextUpiId) {
      throw new AppError(
        "A UPI ID is required to enable UPI payments",
        "UPI_ID_REQUIRED",
        400
      );
    }

    const { data, error } = await supabase
      .from("payment_methods")
      .update({
        is_enabled: nextEnabled,
        upi_id: nextUpiId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new AppError(error.message, "PAYMENT_METHOD_UPDATE_FAILED", 400);
    return data;
  },
};
