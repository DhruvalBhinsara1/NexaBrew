import { z } from "zod";

const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(HEX_COLOR, "Color must be a 6-digit hex, e.g. #FF5733"),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z
  .object({
    name: z.string().min(1).optional(),
    color: z.string().regex(HEX_COLOR, "Color must be a 6-digit hex").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
