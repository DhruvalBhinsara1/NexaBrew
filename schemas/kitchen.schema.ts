import { z } from "zod";

/** Allowed status values that a caller can request via PATCH /kitchen/tickets/:id */
export const AdvanceTicketStatusSchema = z.object({
  status: z.enum(["preparing", "completed"], {
    error: "status must be 'preparing' or 'completed'",
  }),
});
export type AdvanceTicketStatusInput = z.infer<typeof AdvanceTicketStatusSchema>;

/** Optional filter for GET /api/kitchen/tickets */
export const KitchenTicketStatusFilter = z.enum(["to_cook", "preparing", "completed"]);
export type KitchenTicketStatusFilterValue = z.infer<typeof KitchenTicketStatusFilter>;
