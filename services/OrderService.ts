import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Coupon, OrderStatus, OrderWithItems } from "@/types/domain.types";
import type { CreateOrderInput, UpdateOrderInput } from "@/schemas/order.schema";
import { AppError } from "@/lib/utils/app-error";
import {
  buildDiscountState,
  freeTable,
  mapDatabaseError,
  orderItemsToDiscountableItems,
  snapshotItems,
} from "@/services/OrderPricing";

type Supa = SupabaseClient<Database>;

export const ORDER_SELECT =
  "*, items:order_items(*), table:tables(id, table_number), customer:customers(id, name, email), employee:users!orders_employee_id_fkey(id, name), coupon:coupons(id, code, discount_type, discount_value), promotion:promotions(id, name)";

export interface OrderFilters {
  sessionId?: string;
  status?: OrderStatus;
  tableId?: string;
  search?: string;
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
    const discountState = await buildDiscountState(supabase, items);

    const { data: inserted, error: insertError } = await supabase
      .from("orders")
      .insert({
        session_id: payload.session_id,
        table_id: payload.table_id ?? null,
        customer_id: payload.customer_id ?? null,
        employee_id: employeeId,
        status: "draft",
        subtotal: discountState.subtotal,
        discount_amount: discountState.discount_amount,
        tax_amount: discountState.tax_amount,
        total_amount: discountState.total_amount,
        coupon_id: discountState.coupon_id,
        promotion_id: discountState.promotion_id,
      })
      .select("id")
      .single();
    if (insertError) throw mapDatabaseError(insertError, "ORDER_CREATE_FAILED");

    if (discountState.items.length > 0) {
      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(discountState.items.map((item) => ({ ...item, order_id: inserted.id })));
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
      const discountState = await buildDiscountState(supabase, items, order.coupon?.code ?? null);
      updatePayload.subtotal = discountState.subtotal;
      updatePayload.discount_amount = discountState.discount_amount;
      updatePayload.tax_amount = discountState.tax_amount;
      updatePayload.total_amount = discountState.total_amount;
      updatePayload.coupon_id = discountState.coupon_id;
      updatePayload.promotion_id = discountState.promotion_id;

      const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", id);
      if (deleteError) throw new AppError(deleteError.message, "ORDER_ITEMS_UPDATE_FAILED", 400);

      if (discountState.items.length > 0) {
        const { error: insertItemsError } = await supabase
          .from("order_items")
          .insert(discountState.items.map((item) => ({ ...item, order_id: id })));
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

  async applyCoupon(
    supabase: Supa,
    id: string,
    code: string
  ): Promise<{ order: OrderWithItems; coupon: Coupon; discount_amount: number; new_total: number }> {
    const order = await this.getById(supabase, id);
    if (order.status !== "draft") {
      throw new AppError("Coupon can only be applied to draft orders", "ORDER_NOT_EDITABLE", 409);
    }
    if (order.items.length === 0) {
      throw new AppError("Cannot apply a coupon to an empty order", "EMPTY_ORDER", 400);
    }

    const items = orderItemsToDiscountableItems(order.items);
    const discountState = await buildDiscountState(supabase, items, code);
    if (!discountState.coupon) {
      throw new AppError("Invalid coupon code", "COUPON_INVALID", 404);
    }

    const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", id);
    if (deleteError) throw new AppError(deleteError.message, "ORDER_ITEMS_UPDATE_FAILED", 400);

    const { error: insertItemsError } = await supabase
      .from("order_items")
      .insert(discountState.items.map((item) => ({ ...item, order_id: id })));
    if (insertItemsError) throw mapDatabaseError(insertItemsError, "ORDER_ITEMS_UPDATE_FAILED");

    const { data, error } = await supabase
      .from("orders")
      .update({
        coupon_id: discountState.coupon_id,
        promotion_id: null,
        subtotal: discountState.subtotal,
        discount_amount: discountState.discount_amount,
        tax_amount: discountState.tax_amount,
        total_amount: discountState.total_amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "ORDER_UPDATE_FAILED");
    if (!data) throw new AppError("Order is not editable", "ORDER_NOT_EDITABLE", 409);

    return {
      order: await this.getById(supabase, id),
      coupon: discountState.coupon,
      discount_amount: discountState.order_discount,
      new_total: discountState.total_amount,
    };
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
