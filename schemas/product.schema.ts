import { z } from "zod";

const UNIT_OF_MEASURE = ["piece", "kg", "litre"] as const;

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category_id: z.string().uuid("A valid category is required"),
  price: z.number().positive("Price must be greater than 0"),
  unit_of_measure: z.enum(UNIT_OF_MEASURE).default("piece"),
  tax_rate: z.number().min(0).max(100).default(0),
  description: z.string().optional(),
  is_kitchen_display: z.boolean().default(true),
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

// Defined without defaults so a PATCH only touches the fields it sends.
export const UpdateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    category_id: z.string().uuid().optional(),
    price: z.number().positive().optional(),
    unit_of_measure: z.enum(UNIT_OF_MEASURE).optional(),
    tax_rate: z.number().min(0).max(100).optional(),
    description: z.string().nullable().optional(),
    is_kitchen_display: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
