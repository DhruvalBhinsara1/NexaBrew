import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const DateRangeSchema = z
  .object({
    from: isoDate,
    to: isoDate,
  })
  .refine((v) => v.from <= v.to, {
    message: "'from' must be on or before 'to'",
    path: ["from"],
  });
export type DateRangeInput = z.infer<typeof DateRangeSchema>;

export const TopProductsQuerySchema = DateRangeSchema.and(
  z.object({
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10), 1), 50) : 10)),
  })
);
export type TopProductsQueryInput = z.infer<typeof TopProductsQuerySchema>;
