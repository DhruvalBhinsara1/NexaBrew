import { z } from "zod";

const CashPaymentSchema = z.object({
  payment_method_type: z.literal("cash"),
  amount_tendered: z.number().positive("Amount tendered must be greater than 0"),
});

// Razorpay: client sends back the 3 identifiers after checkout success.
// Server verifies the HMAC-SHA256 signature before recording the payment.
const RazorpayPaymentSchema = z.object({
  payment_method_type: z.literal("razorpay"),
  razorpay_payment_id: z.string().min(1, "Missing razorpay_payment_id"),
  razorpay_order_id: z.string().min(1, "Missing razorpay_order_id"),
  razorpay_signature: z.string().min(1, "Missing razorpay_signature"),
});

export const ProcessPaymentSchema = z.discriminatedUnion("payment_method_type", [
  CashPaymentSchema,
  RazorpayPaymentSchema,
]);

export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;
export type CashPaymentInput = z.infer<typeof CashPaymentSchema>;
export type RazorpayPaymentInput = z.infer<typeof RazorpayPaymentSchema>;

export const SendReceiptSchema = z.object({
  email: z.string().email("A valid email is required").optional(),
});
export type SendReceiptInput = z.infer<typeof SendReceiptSchema>;
