import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Coupon, OrderStatus, OrderWithItems } from "@/types/domain.types";
import type { CreateOrderInput, UpdateOrderInput } from "@/schemas/order.schema";
import type { PaginatedResponse } from "@/types/pagination.types";
import { AppError } from "@/lib/utils/app-error";
import {
  buildDiscountState,
  freeTable,
  mapDatabaseError,
  orderItemsToDiscountableItems,
  snapshotItems,
} from "@/services/OrderPricing";
import {
  calculateOffset,
  calculatePaginationMeta,
  DEFAULT_PAGE_SIZE,
} from "@/lib/utils/pagination";

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

  async listPaginated(
    supabase: Supa,
    filters: OrderFilters,
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE
  ): Promise<PaginatedResponse<OrderWithItems>> {
    // Get total count
    let countQuery = supabase.from("orders").select("id", { count: "exact" });
    if (filters.sessionId) countQuery = countQuery.eq("session_id", filters.sessionId);
    if (filters.status) countQuery = countQuery.eq("status", filters.status);
    if (filters.tableId) countQuery = countQuery.eq("table_id", filters.tableId);
    if (filters.search) countQuery = countQuery.ilike("order_number", `%${filters.search}%`);

    const { count, error: countError } = await countQuery;
    if (countError) throw new AppError(countError.message, "ORDERS_COUNT_FAILED", 500);

    // Get paginated data
    let dataQuery = supabase.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false });
    if (filters.sessionId) dataQuery = dataQuery.eq("session_id", filters.sessionId);
    if (filters.status) dataQuery = dataQuery.eq("status", filters.status);
    if (filters.tableId) dataQuery = dataQuery.eq("table_id", filters.tableId);
    if (filters.search) dataQuery = dataQuery.ilike("order_number", `%${filters.search}%`);

    const offset = calculateOffset(page, limit);
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    const { data, error } = await dataQuery;
    if (error) throw new AppError(error.message, "ORDERS_LIST_FAILED", 500);

    const total = count ?? 0;
    const paginationMeta = calculatePaginationMeta(page, limit, total);

    return {
      data: (data ?? []) as OrderWithItems[],
      pagination: paginationMeta,
    };
  },

  /**
   * Orders belonging to a logged-in customer — resolved via the CRM rows
   * linked to their auth user (customers.user_id). Used by the /menu surface.
   */
  async listForCustomerUser(supabase: Supa, userId: string): Promise<OrderWithItems[]> {
    const { data: crm, error: crmError } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId);
    if (crmError) throw new AppError(crmError.message, "CUSTOMER_FETCH_FAILED", 500);

    const ids = (crm ?? []).map((c) => c.id);
    if (ids.length === 0) return [];

    // Include the kitchen ticket status so the customer view can show the
    // granular kitchen stage (to_cook vs preparing), which the order status
    // alone can't express (it stays 'sent_to_kitchen' across both).
    const { data, error } = await supabase
      .from("orders")
      .select(`${ORDER_SELECT}, kitchen_tickets(status)`)
      .in("customer_id", ids)
      .order("created_at", { ascending: false });
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

  /**
   * Self-service order placed by a logged-in customer from /menu. Resolves the
   * customer's CRM row and the current open session server-side (never trusts
   * the client), then creates the order with the customer as its own creator
   * (employee_id = their uid, satisfying the orders_insert_own RLS policy).
   */
  async createForCustomerUser(
    supabase: Supa,
    userId: string,
    payload: { items: CreateOrderInput["items"]; table_id?: string | null; coupon_code?: string | null }
  ): Promise<OrderWithItems> {
    const { data: crm, error: crmErr } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (crmErr) throw new AppError(crmErr.message, "CUSTOMER_FETCH_FAILED", 500);
    if (!crm) throw new AppError("No customer profile is linked to this account.", "CUSTOMER_NOT_FOUND", 400);

    const { data: sess, error: sessErr } = await supabase
      .from("sessions")
      .select("id")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessErr) throw new AppError(sessErr.message, "SESSION_FETCH_FAILED", 500);
    if (!sess) {
      throw new AppError("Ordering is closed right now — please try again during opening hours.", "SESSION_NOT_OPEN", 409);
    }

    const { order } = await this.create(
      supabase,
      { session_id: sess.id, table_id: payload.table_id ?? null, customer_id: crm.id, items: payload.items },
      userId
    );

    if (payload.coupon_code) {
      // Coupon failures are non-fatal for a self-service customer.
      try {
        await this.applyCoupon(supabase, order.id, payload.coupon_code);
      } catch {
        /* ignore — order still placed at full price */
      }
    }

    return this.getById(supabase, order.id);
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

    // NOTE: the table is NOT marked occupied here. A draft order leaves the
    // table available; it only becomes occupied once the order is sent to the
    // kitchen (KitchenService.sendToKitchen). Freed again on cancel/payment.

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

  /**
   * Assign (or move) a table for an active, unpaid order that has none — e.g.
   * a bill was sent to the kitchen before a table was chosen. Only allowed
   * while the order is active (sent_to_kitchen | payment_pending) and the
   * target table is active and not already occupied. Occupies the new table.
   */
  async assignTable(supabase: Supa, id: string, tableId: string): Promise<OrderWithItems> {
    const order = await this.getById(supabase, id);
    if (order.status !== "sent_to_kitchen" && order.status !== "payment_pending") {
      throw new AppError("Table can only be assigned to an active bill", "ORDER_NOT_ASSIGNABLE", 409);
    }
    if (order.table_id) {
      throw new AppError("This bill already has a table", "ORDER_HAS_TABLE", 409);
    }

    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id, is_active, status")
      .eq("id", tableId)
      .maybeSingle();
    if (tableError) throw new AppError(tableError.message, "TABLE_FETCH_FAILED", 500);
    if (!table) throw new AppError("Table not found", "TABLE_NOT_FOUND", 404);
    if (!table.is_active) throw new AppError("Table is inactive", "TABLE_INACTIVE", 400);
    if (table.status === "occupied") {
      throw new AppError("Table is already occupied", "TABLE_OCCUPIED", 409);
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ table_id: tableId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("table_id", null)
      .in("status", ["sent_to_kitchen", "payment_pending"])
      .select("id")
      .maybeSingle();
    if (error) throw mapDatabaseError(error, "ORDER_ASSIGN_TABLE_FAILED");
    if (!data) throw new AppError("Table could not be assigned", "ORDER_NOT_ASSIGNABLE", 409);

    const { error: occupyError } = await supabase
      .from("tables")
      .update({ status: "occupied" })
      .eq("id", tableId);
    if (occupyError) throw new AppError(occupyError.message, "TABLE_UPDATE_FAILED", 400);

    return this.getById(supabase, id);
  },

  /**
   * Add items to an existing unpaid order (sent_to_kitchen | payment_pending)
   * — "add to the same bill". Items are merged/upserted (existing order_items
   * rows are never deleted, to keep kitchen_ticket_items FKs valid), the bill
   * is recomputed (coupon preserved), the added items are sent to the kitchen
   * as a new ticket, and the order returns to sent_to_kitchen.
   */
  async addItems(
    supabase: Supa,
    id: string,
    newItems: { product_id: string; quantity: number }[]
  ): Promise<OrderWithItems> {
    const order = await this.getById(supabase, id);
    if (order.status !== "sent_to_kitchen" && order.status !== "payment_pending") {
      throw new AppError(
        "Items can only be added to an active, unpaid order",
        "ORDER_NOT_APPENDABLE",
        409
      );
    }

    // Merge existing + new quantities by product, then re-price/-discount the
    // whole set (snapshot dedups by product and refetches current prices).
    const merged = new Map<string, number>();
    for (const it of order.items) merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.quantity);
    for (const it of newItems) merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.quantity);
    const mergedItems = Array.from(merged, ([product_id, quantity]) => ({ product_id, quantity }));

    const snapshot = await snapshotItems(supabase, mergedItems);
    const discountState = await buildDiscountState(supabase, snapshot, order.coupon?.code ?? null);

    // Upsert by product_id — update existing rows (keeps their ids), insert new.
    const existingByProduct = new Map(order.items.map((i) => [i.product_id, i]));
    for (const item of discountState.items) {
      const existing = existingByProduct.get(item.product_id);
      if (existing) {
        const { error } = await supabase
          .from("order_items")
          .update({
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            discount_amount: item.discount_amount,
            line_total: item.line_total,
            promotion_id: item.promotion_id,
          })
          .eq("id", existing.id);
        if (error) throw mapDatabaseError(error, "ORDER_ITEMS_UPDATE_FAILED");
      } else {
        const { error } = await supabase
          .from("order_items")
          .insert({ ...item, order_id: id });
        if (error) throw mapDatabaseError(error, "ORDER_ITEMS_UPDATE_FAILED");
      }
    }

    // Recompute order aggregate + return to the kitchen.
    const { error: updErr } = await supabase
      .from("orders")
      .update({
        subtotal: discountState.subtotal,
        discount_amount: discountState.discount_amount,
        tax_amount: discountState.tax_amount,
        total_amount: discountState.total_amount,
        coupon_id: discountState.coupon_id,
        promotion_id: discountState.promotion_id,
        status: "sent_to_kitchen",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updErr) throw mapDatabaseError(updErr, "ORDER_UPDATE_FAILED");

    // Send the ADDED items to the kitchen as a new ticket (kitchen-display only).
    const newProductIds = newItems.map((i) => i.product_id);
    const { data: products } = await supabase
      .from("products")
      .select("id, is_kitchen_display")
      .in("id", newProductIds);
    const kitchenIds = new Set((products ?? []).filter((p) => p.is_kitchen_display).map((p) => p.id));

    const updated = await this.getById(supabase, id);
    const orderItemByProduct = new Map(updated.items.map((i) => [i.product_id, i]));
    const ticketItems = newItems
      .filter((i) => kitchenIds.has(i.product_id))
      .map((i) => {
        const oi = orderItemByProduct.get(i.product_id);
        return oi ? { order_item_id: oi.id, product_name: oi.product_name, quantity: i.quantity } : null;
      })
      .filter((x): x is { order_item_id: string; product_name: string; quantity: number } => x !== null);

    if (ticketItems.length > 0) {
      const { data: ticket, error: ticketErr } = await supabase
        .from("kitchen_tickets")
        .insert({ order_id: id, ticket_number: order.order_number, status: "to_cook" })
        .select("id")
        .single();
      if (ticketErr) throw mapDatabaseError(ticketErr, "KITCHEN_TICKET_CREATE_FAILED");
      const { error: itemsErr } = await supabase
        .from("kitchen_ticket_items")
        .insert(ticketItems.map((t) => ({ ...t, ticket_id: ticket.id })));
      if (itemsErr) throw mapDatabaseError(itemsErr, "KITCHEN_TICKET_ITEMS_CREATE_FAILED");
    }

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
