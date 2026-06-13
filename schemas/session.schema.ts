import { z } from "zod";

export const OpenSessionSchema = z.object({
  opening_balance: z.number().min(0, "Opening balance cannot be negative").default(0),
});
export type OpenSessionInput = z.infer<typeof OpenSessionSchema>;

export const CloseSessionSchema = z.object({
  notes: z.string().optional(),
});
export type CloseSessionInput = z.infer<typeof CloseSessionSchema>;

export const SessionStatusFilter = z.enum(["open", "closed"]);
