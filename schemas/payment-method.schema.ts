import { z } from "zod";

export const UpdatePaymentMethodSchema = z
  .object({
    is_enabled: z.boolean().optional(),
    upi_id: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdatePaymentMethodInput = z.infer<typeof UpdatePaymentMethodSchema>;
