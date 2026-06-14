import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  KitchenTicket,
  KitchenTicketItem,
  KitchenTicketStatus,
  KitchenTicketWithItems,
} from "@/types/domain.types";
import { AppError } from "@/lib/utils/app-error";
import { OrderService } from "@/services/OrderService";

type Supa = SupabaseClient<Database>;

type TicketResult = {
  order: { id: string; status: string };
  ticket: Pick<KitchenTicket, "id" | "ticket_number" | "status">;
};

type AdvanceResult = {
  ticket: KitchenTicket;
  order?: { id: string; status: string };
};

const NEXT_STATUS: Record<Exclude<KitchenTicketStatus, "completed">, KitchenTicketStatus> = {
  to_cook: "preparing",
  preparing: "completed",
};

export const KitchenService = {
  async listTickets(
    supabase: Supa,
    filters: { status?: KitchenTicketStatus; orderId?: string } = {}
  ): Promise<KitchenTicketWithItems[]> {
    let query = supabase
      .from("kitchen_tickets")
      .select("*, items:kitchen_ticket_items(*)")
      .order("sent_at", { ascending: true });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.orderId) query = query.eq("order_id", filters.orderId);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, "KITCHEN_TICKETS_FETCH_FAILED", 500);
    return (data ?? []) as KitchenTicketWithItems[];
  },

  async sendToKitchen(supabase: Supa, orderId: string): Promise<TicketResult> {
    const order = await OrderService.getById(supabase, orderId);
    if (order.status !== "draft") {
      throw new AppError("Only draft orders can be sent to kitchen", "ORDER_NOT_SENDABLE", 409);
    }
    if (order.items.length === 0) {
      throw new AppError("Cannot send an empty order to kitchen", "EMPTY_ORDER", 400);
    }

    const productIds = order.items.map((item) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, is_kitchen_display")
      .in("id", productIds);
    if (productsError) throw new AppError(productsError.message, "PRODUCTS_FETCH_FAILED", 500);

    const kitchenProductIds = new Set(
      (products ?? [])
        .filter((product) => product.is_kitchen_display)
        .map((product) => product.id)
    );
    const qualifyingItems = order.items.filter((item) => kitchenProductIds.has(item.product_id));

    if (qualifyingItems.length === 0) {
      throw new AppError("Order has no kitchen display items", "NO_KITCHEN_ITEMS", 400);
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("kitchen_tickets")
      .insert({
        order_id: order.id,
        ticket_number: order.order_number,
        status: "to_cook",
      })
      .select("id, ticket_number, status")
      .single();
    if (ticketError) throw new AppError(ticketError.message, "KITCHEN_TICKET_CREATE_FAILED", 400);

    const { error: itemsError } = await supabase.from("kitchen_ticket_items").insert(
      qualifyingItems.map((item) => ({
        ticket_id: ticket.id,
        order_item_id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
      }))
    );
    if (itemsError) {
      await supabase.from("kitchen_tickets").delete().eq("id", ticket.id);
      throw new AppError(itemsError.message, "KITCHEN_TICKET_ITEMS_CREATE_FAILED", 400);
    }

    const { data: updatedOrder, error: orderError } = await supabase
      .from("orders")
      .update({ status: "sent_to_kitchen", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "draft")
      .select("id, status")
      .maybeSingle();
    if (orderError) {
      await supabase.from("kitchen_ticket_items").delete().eq("ticket_id", ticket.id);
      await supabase.from("kitchen_tickets").delete().eq("id", ticket.id);
      throw new AppError(orderError.message, "ORDER_STATUS_UPDATE_FAILED", 400);
    }
    if (!updatedOrder) {
      await supabase.from("kitchen_ticket_items").delete().eq("ticket_id", ticket.id);
      await supabase.from("kitchen_tickets").delete().eq("id", ticket.id);
      throw new AppError("Only draft orders can be sent to kitchen", "ORDER_NOT_SENDABLE", 409);
    }

    // Mark the table occupied now that the order is in the kitchen (a draft
    // alone does not occupy the table). Best-effort: a failure here must not
    // undo a successfully-sent order, so we don't roll back on it.
    if (order.table_id) {
      await supabase.from("tables").update({ status: "occupied" }).eq("id", order.table_id);
    }

    return { order: updatedOrder, ticket };
  },

  async advanceTicketStatus(
    supabase: Supa,
    ticketId: string,
    newStatus: KitchenTicketStatus
  ): Promise<AdvanceResult> {
    const { data: existing, error: fetchError } = await supabase
      .from("kitchen_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();
    if (fetchError) throw new AppError(fetchError.message, "KITCHEN_TICKET_FETCH_FAILED", 500);
    if (!existing) {
      throw new AppError("Kitchen ticket not found", "KITCHEN_TICKET_NOT_FOUND", 404);
    }

    const currentStatus = existing.status as KitchenTicketStatus;
    if (currentStatus === "completed" || NEXT_STATUS[currentStatus] !== newStatus) {
      throw new AppError("Invalid kitchen ticket transition", "INVALID_TICKET_TRANSITION", 422);
    }

    const { data: ticket, error: updateError } = await supabase
      .from("kitchen_tickets")
      .update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", ticketId)
      .eq("status", currentStatus)
      .select("*")
      .maybeSingle();
    if (updateError) throw new AppError(updateError.message, "KITCHEN_TICKET_UPDATE_FAILED", 400);
    if (!ticket) {
      throw new AppError("Kitchen ticket changed state", "KITCHEN_TICKET_CONFLICT", 409);
    }

    if (newStatus !== "completed") {
      // Entering a fresh working stage: reset item check-offs so the cook
      // ticks them off again here. Striking the last item then advances the
      // ticket once more. Non-fatal — a failed reset just leaves items as-is.
      await supabase
        .from("kitchen_ticket_items")
        .update({ is_completed: false })
        .eq("ticket_id", ticketId);
      return { ticket: ticket as KitchenTicket };
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .update({ status: "payment_pending", updated_at: new Date().toISOString() })
      .eq("id", ticket.order_id)
      .eq("status", "sent_to_kitchen")
      .select("id, status")
      .maybeSingle();
    if (orderError) throw new AppError(orderError.message, "ORDER_STATUS_UPDATE_FAILED", 400);

    return {
      ticket: ticket as KitchenTicket,
      order: order ?? undefined,
    };
  },

  async completeTicketItem(
    supabase: Supa,
    ticketId: string,
    itemId: string
  ): Promise<KitchenTicketItem> {
    const { data, error } = await supabase
      .from("kitchen_ticket_items")
      .update({ is_completed: true })
      .eq("id", itemId)
      .eq("ticket_id", ticketId)
      .select("*")
      .maybeSingle();
    if (error) throw new AppError(error.message, "KITCHEN_TICKET_ITEM_UPDATE_FAILED", 400);
    if (!data) {
      throw new AppError("Kitchen ticket item not found", "KITCHEN_TICKET_ITEM_NOT_FOUND", 404);
    }
    return data as KitchenTicketItem;
  },
};
