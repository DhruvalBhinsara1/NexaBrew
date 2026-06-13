import { z } from "zod";

const OrderItemInputSchema = z.object({
  product_id: z.string().uuid("A valid product is required"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
});

export const CreateOrderSchema = z.object({
  session_id: z.string().uuid("A valid session is required"),
  table_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  items: z.array(OrderItemInputSchema).default([]),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const UpdateOrderSchema = z
  .object({
    customer_id: z.string().uuid().nullable().optional(),
    items: z.array(OrderItemInputSchema).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;

export const OrderStatusFilter = z.enum([
  "draft",
  "sent_to_kitchen",
  "payment_pending",
  "paid",
  "cancelled",
]);
