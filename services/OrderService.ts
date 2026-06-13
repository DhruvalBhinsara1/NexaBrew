import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { OrderItem, OrderStatus, OrderWithItems, Table } from "@/types/domain.types";
import type { CreateOrderInput, UpdateOrderInput } from "@/schemas/order.schema";
import { AppError } from "@/lib/utils/app-error";
import { calculateTotals, type LineInput } from "@/lib/utils/calculateTotals";

type Supa = SupabaseClient<Database>;

export const ORDER_SELECT =
  "*, items:order_items(*), table:tables(id, table_number), customer:customers(id, name, email), employee:users!orders_employee_id_fkey(id, name), coupon:coupons(id, code, discount_type, discount_value), promotion:promotions(id, name)";

export interface OrderFilters {
  sessionId?: string;
  status?: OrderStatus;
  tableId?: string;
  search?: string;
}

type OrderItemInput = CreateOrderInput["items"][number];
type ProductSnapshot = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "name" | "price" | "tax_rate" | "is_active"
>;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function mapDatabaseError(error: { message: string; code?: string }, fallbackCode: string): AppError {
  if (error.code === "23505") {
    return new AppError("Duplicate record", "DUPLICATE_RECORD", 409);
  }
  if (error.code === "23503") {
    return new AppError("Referenced record not found", "REFERENCE_NOT_FOUND", 404);
  }
  return new AppError(error.message, fallbackCode, 400);
}

function normalizeItems(items: OrderItemInput[]): OrderItemInput[] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
  }
  return Array.from(quantities, ([product_id, quantity]) => ({ product_id, quantity }));
}

async function snapshotItems(
  supabase: Supa,
  items: OrderItemInput[]
): Promise<Array<Omit<OrderItem, "id" | "order_id" | "promotion_id"> & { promotion_id: null }>> {
  const normalized = normalizeItems(items);
  if (normalized.length === 0) return [];

  const productIds = normalized.map((item) => item.product_id);
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, tax_rate, is_active")
    .in("id", productIds);
  if (error) throw new AppError(error.message, "PRODUCTS_FETCH_FAILED", 500);

  const products = new Map((data ?? []).map((product) => [product.id, product as ProductSnapshot]));
  return normalized.map((item) => {
    const product = products.get(item.product_id);
    if (!product || !product.is_active) {
      throw new AppError("Product is unavailable", "PRODUCT_UNAVAILABLE", 400);
    }

    const discountAmount = 0;
    const base = Number(product.price) * item.quantity;
    return {
      product_id: product.id,
      product_name: product.name,
      unit_price: Number(product.price),
      tax_rate: Number(product.tax_rate),
      quantity: item.quantity,
      discount_amount: discountAmount,
      line_total: round2(base - discountAmount),
      promotion_id: null,
    };
  });
}

async function freeTable(supabase: Supa, tableId: string | null): Promise<void> {
  if (!tableId) return;
  const { error } = await supabase
    .from("tables")
    .update({ status: "available" })
    .eq("id", tableId);
  if (error) throw new AppError(error.message, "TABLE_UPDATE_FAILED", 400);
}

function totalsFor(items: Pick<OrderItem, "unit_price" | "quantity" | "tax_rate" | "discount_amount">[]) {
  const lines: LineInput[] = items.map((item) => ({
    unitPrice: Number(item.unit_price),
    quantity: item.quantity,
    taxRate: Number(item.tax_rate),
    discountAmount: Number(item.discount_amount),
  }));
  return calculateTotals({ items: lines, orderDiscount: 0 });
}

export const OrderService = {
  async list(supabase: Supa, filters: OrderFilters): Promise<OrderWithItems[]> {
    let query = supabase.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false });

    if (filters.sessionId) query = query.eq("session_id", filters.sessionId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.tableId) query = query.eq("table_id", filters.tableId);
    if (filters.search) query = query.ilike("order_number", `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, "ORDERS_LIST_FAILED", 500);
    return (data ?? []) as OrderWithItems[];
  },

  async getById(supabase: Supa, id: string): Promise<OrderWithItems> {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new AppError(error.message, "ORDER_FETCH_FAILED", 500);
    if (!data) throw new AppError("Order not found", "ORDER_NOT_FOUND", 404);
    return data as OrderWithItems;
  },

  async create(
    supabase: Supa,
    payload: CreateOrderInput,
    employeeId: string
  ): Promise<{ order: OrderWithItems; created: boolean }> {
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, status")
      .eq("id", payload.session_id)
      .maybeSingle();
    if (sessionError) throw new AppError(sessionError.message, "SESSION_FETCH_FAILED", 500);
    if (!session || session.status !== "open") {
      throw new AppError("Session is not open", "SESSION_NOT_OPEN", 400);
    }

    if (payload.table_id) {
      const { data: existing, error: existingError } = await supabase
        .from("orders")
        .select("id")
        .eq("table_id", payload.table_id)
        .eq("session_id", payload.session_id)
        .eq("status", "draft")
        .limit(1)
        .maybeSingle();
      if (existingError) throw new AppError(existingError.message, "ORDER_FETCH_FAILED", 500);
      if (existing) {
        return { order: await this.getById(supabase, existing.id), created: false };
      }

      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("id, is_active, status")
        .eq("id", payload.table_id)
        .maybeSingle();
      if (tableError) throw new AppError(tableError.message, "TABLE_FETCH_FAILED", 500);
      if (!table) throw new AppError("Table not found", "TABLE_NOT_FOUND", 404);
      if (!table.is_active) throw new AppError("Table is inactive", "TABLE_INACTIVE", 400);
      if (table.status === "occupied") {
        throw new AppError("Table is already occupied", "TABLE_OCCUPIED", 409);
      }
    }

    const items = await snapshotItems(supabase, payload.items);
    const totals = totalsFor(items);

    const { data: inserted, error: insertError } = await supabase
      .from("orders")
      .insert({
        session_id: payload.session_id,
        table_id: payload.table_id ?? null,
        customer_id: payload.customer_id ?? null,
        employee_id: employeeId,
        status: "draft",
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
      })
      .select("id")
      .single();
    if (insertError) throw mapDatabaseError(insertError, "ORDER_CREATE_FAILED");

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(items.map((item) => ({ ...item, order_id: inserted.id })));
      if (itemsError) {
        await supabase.from("orders").delete().eq("id", inserted.id);
        throw mapDatabaseError(itemsError, "ORDER_ITEMS_CREATE_FAILED");
      }
    }

    if (payload.table_id) {
      const { data: occupiedTable, error: tableUpdateError } = await supabase
        .from("tables")
        .update({ status: "occupied" })
        .eq("id", payload.table_id)
        .eq("status", "available")
        .select("id")
        .maybeSingle();
      if (tableUpdateError) {
        await supabase.from("orders").delete().eq("id", inserted.id);
        throw new AppError(tableUpdateError.message, "TABLE_UPDATE_FAILED", 400);
      }
      if (!occupiedTable) {
        await supabase.from("orders").delete().eq("id", inserted.id);
        throw new AppError("Table is already occupied", "TABLE_OCCUPIED", 409);
      }
    }

    return { order: await this.getById(supabase, inserted.id), created: true };
  },

  async update(supabase: Supa, id: string, payload: UpdateOrderInput): Promise<OrderWithItems> {
    const order = await this.getById(supabase, id);
    if (order.status !== "draft") {
      throw new AppError("Order is not editable", "ORDER_NOT_EDITABLE", 409);
    }

    const updatePayload: Database["public"]["Tables"]["orders"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    if ("customer_id" in payload) updatePayload.customer_id = payload.customer_id ?? null;

    if (payload.items) {
      const items = await snapshotItems(supabase, payload.items);
      const totals = totalsFor(items);
      updatePayload.subtotal = totals.subtotal;
      updatePayload.discount_amount = totals.discountAmount;
      updatePayload.tax_amount = totals.taxAmount;
      updatePayload.total_amount = totals.totalAmount;

      const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", id);
      if (deleteError) throw new AppError(deleteError.message, "ORDER_ITEMS_UPDATE_FAILED", 400);

      if (items.length > 0) {
        const { error: insertItemsError } = await supabase
          .from("order_items")
          .insert(items.map((item) => ({ ...item, order_id: id })));
        if (insertItemsError) throw mapDatabaseError(insertItemsError, "ORDER_ITEMS_UPDATE_FAILED");
      }
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "ORDER_UPDATE_FAILED");
    if (!data) throw new AppError("Order is not editable", "ORDER_NOT_EDITABLE", 409);

    return this.getById(supabase, id);
  },

  async cancel(supabase: Supa, id: string): Promise<OrderWithItems> {
    const order = await this.getById(supabase, id);
    if (order.status !== "draft" && order.status !== "sent_to_kitchen") {
      throw new AppError("Order cannot be cancelled", "ORDER_NOT_CANCELLABLE", 409);
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["draft", "sent_to_kitchen"])
      .select("id")
      .maybeSingle();
    if (error) throw new AppError(error.message, "ORDER_CANCEL_FAILED", 400);
    if (!data) throw new AppError("Order cannot be cancelled", "ORDER_NOT_CANCELLABLE", 409);

    await freeTable(supabase, order.table_id);
    return this.getById(supabase, id);
  },

  async remove(supabase: Supa, id: string): Promise<void> {
    const order = await this.getById(supabase, id);
    if (order.status !== "draft") {
      throw new AppError("Only draft orders can be deleted", "ONLY_DRAFT_DELETABLE", 409);
    }

    await freeTable(supabase, order.table_id);
    const { error } = await supabase.from("orders").delete().eq("id", id).eq("status", "draft");
    if (error) throw new AppError(error.message, "ORDER_DELETE_FAILED", 400);
  },
};
