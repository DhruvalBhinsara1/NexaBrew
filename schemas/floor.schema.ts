import { z } from "zod";

export const CreateFloorSchema = z.object({
  name: z.string().min(1, "Floor name is required"),
});
export type CreateFloorInput = z.infer<typeof CreateFloorSchema>;

export const UpdateFloorSchema = z.object({
  name: z.string().min(1, "Floor name is required"),
});
export type UpdateFloorInput = z.infer<typeof UpdateFloorSchema>;

export const CreateTableSchema = z.object({
  table_number: z.number().int().positive("Table number must be a positive integer"),
  seats: z.number().int().positive("Seats must be greater than 0"),
});
export type CreateTableInput = z.infer<typeof CreateTableSchema>;

export const UpdateTableSchema = z
  .object({
    table_number: z.number().int().positive().optional(),
    seats: z.number().int().positive().optional(),
    is_active: z.boolean().optional(),
    status: z.enum(["available", "occupied"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateTableInput = z.infer<typeof UpdateTableSchema>;
