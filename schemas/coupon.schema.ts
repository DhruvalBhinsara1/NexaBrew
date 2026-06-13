import { z } from "zod";

const DiscountTypeSchema = z.enum(["percentage", "fixed"]);

export const ApplyCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").transform((v) => v.trim().toUpperCase()),
});
export type ApplyCouponInput = z.infer<typeof ApplyCouponSchema>;

export const CreateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").transform((v) => v.trim().toUpperCase()),
  discount_type: DiscountTypeSchema,
  discount_value: z.number().positive("Discount value must be greater than 0"),
  is_active: z.boolean().default(true),
  max_uses: z.number().int().positive().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});
export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;

export const UpdateCouponSchema = z
  .object({
    code: z.string().min(1).transform((v) => v.trim().toUpperCase()).optional(),
    discount_type: DiscountTypeSchema.optional(),
    discount_value: z.number().positive().optional(),
    is_active: z.boolean().optional(),
    max_uses: z.number().int().positive().nullable().optional(),
    expires_at: z.string().datetime().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;

const BasePromotionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  discount_type: DiscountTypeSchema,
  discount_value: z.number().positive("Discount value must be greater than 0"),
  is_active: z.boolean().default(true),
});

export const CreatePromotionSchema = z.discriminatedUnion("applies_to", [
  BasePromotionSchema.extend({
    applies_to: z.literal("product"),
    product_id: z.string().uuid("A valid product is required"),
    min_quantity: z.number().int().positive("Minimum quantity must be greater than 0"),
    min_order_amount: z.null().optional(),
  }),
  BasePromotionSchema.extend({
    applies_to: z.literal("order"),
    product_id: z.null().optional(),
    min_quantity: z.null().optional(),
    min_order_amount: z.number().positive("Minimum order amount must be greater than 0"),
  }),
]);
export type CreatePromotionInput = z.infer<typeof CreatePromotionSchema>;

export const UpdatePromotionSchema = z
  .object({
    name: z.string().min(1).optional(),
    applies_to: z.enum(["product", "order"]).optional(),
    product_id: z.string().uuid().nullable().optional(),
    min_quantity: z.number().int().positive().nullable().optional(),
    min_order_amount: z.number().positive().nullable().optional(),
    discount_type: DiscountTypeSchema.optional(),
    discount_value: z.number().positive().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(
    (v) =>
      v.applies_to !== "product" ||
      (typeof v.product_id === "string" && typeof v.min_quantity === "number"),
    {
      message: "Product promotions require product_id and min_quantity",
    }
  )
  .refine(
    (v) => v.applies_to !== "order" || typeof v.min_order_amount === "number",
    {
      message: "Order promotions require min_order_amount",
    }
  );
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>;
