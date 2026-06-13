import { z } from "zod";

export const CreateCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().min(5, "Phone must be at least 5 characters").optional(),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
    email: z
      .string()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("").transform(() => null))
      .nullable(),
    phone: z
      .string()
      .min(5, "Phone must be at least 5 characters")
      .optional()
      .or(z.literal("").transform(() => null))
      .nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
