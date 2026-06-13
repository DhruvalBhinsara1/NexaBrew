import { z } from "zod";

export const PaymentMethodTypeSchema = z.enum(["cash", "card", "upi"]);

export const ProcessPaymentSchema = z
  .object({
    payment_method_type: PaymentMethodTypeSchema,
    amount_tendered: z.number().positive("Amount tendered must be greater than 0").optional(),
    transaction_reference: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.payment_method_type === "cash" && value.amount_tendered === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["amount_tendered"],
        message: "Amount tendered is required for cash payments",
      });
    }

    if (
      (value.payment_method_type === "card" || value.payment_method_type === "upi") &&
      !value.transaction_reference
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["transaction_reference"],
        message: "Transaction reference is required for card and UPI payments",
      });
    }
  });
export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;

export const SendReceiptSchema = z.object({
  email: z.string().email("A valid email is required").optional(),
});
export type SendReceiptInput = z.infer<typeof SendReceiptSchema>;
