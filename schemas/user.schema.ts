import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "employee", "customer"]);

export const CreateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: UserRoleSchema.default("employee"),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Enter a valid email address").optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
    role: UserRoleSchema.optional(),
    is_archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const UserArchivedFilterSchema = z.enum(["true", "false"]);
