import type { Database } from "@/types/database.types";

// Convenience aliases over the generated Row/Insert/Update types ---------------
type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type InsertRow<T extends keyof Tables> = Tables[T]["Insert"];
export type UpdateRow<T extends keyof Tables> = Tables[T]["Update"];

export type User = Row<"users">;
export type Category = Row<"categories">;
export type Product = Row<"products">;
export type PaymentMethod = Row<"payment_methods">;
export type Floor = Row<"floors">;
export type Table = Row<"tables">;
export type Customer = Row<"customers">;
export type Session = Row<"sessions">;
export type Coupon = Row<"coupons">;
export type Promotion = Row<"promotions">;
export type Order = Row<"orders">;
export type OrderItem = Row<"order_items">;
export type Payment = Row<"payments">;
export type KitchenTicket = Row<"kitchen_tickets">;
export type KitchenTicketItem = Row<"kitchen_ticket_items">;

// Domain enums (mirror the CHECK constraints; columns are `text` in the DB) ----
export type UserRole = "admin" | "employee";
export type OrderStatus =
  | "draft"
  | "sent_to_kitchen"
  | "payment_pending"
  | "paid"
  | "cancelled";
export type KitchenTicketStatus = "to_cook" | "preparing" | "completed";
export type SessionStatus = "open" | "closed";
export type PaymentMethodType = "cash" | "card" | "upi" | "razorpay";
export type PaymentStatus = "pending" | "completed" | "failed";
export type DiscountType = "percentage" | "fixed";
export type TableStatus = "available" | "occupied";

// Composite shapes returned by services / consumed by the UI -------------------
export type CategoryRef = Pick<Category, "id" | "name" | "color">;

export interface ProductWithCategory extends Product {
  category: CategoryRef | null;
}

export interface FloorWithTables extends Floor {
  tables: Table[];
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  table: Pick<Table, "id" | "table_number"> | null;
  customer: Pick<Customer, "id" | "name" | "email"> | null;
  employee: Pick<User, "id" | "name"> | null;
  coupon: Pick<Coupon, "id" | "code" | "discount_type" | "discount_value"> | null;
  promotion: Pick<Promotion, "id" | "name"> | null;
}

export interface KitchenTicketWithItems extends KitchenTicket {
  items: KitchenTicketItem[];
}

export interface SessionWithUser extends Session {
  opened_by_user: Pick<User, "id" | "name"> | null;
}

export interface SessionCloseSummary {
  total_orders: number;
  total_revenue: number;
  cash_collected: number;
  card_collected: number;
}

export interface OrderReceipt {
  order_id: string;
  order_number: string;
  status: OrderStatus | string;
  paid_at: string | null;
  session_id: string;
  table: Pick<Table, "id" | "table_number"> | null;
  customer: Pick<Customer, "id" | "name" | "email"> | null;
  employee: Pick<User, "id" | "name"> | null;
  items: OrderItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment: Payment;
}

export interface PaymentResult {
  payment: Payment;
  order: OrderWithItems;
  receipt: OrderReceipt;
}

export interface UpiQrPayload {
  order_id: string;
  order_number: string;
  amount: number;
  upi_id: string;
  uri: string;
  qr_data_url: string;
}
