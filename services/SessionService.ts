import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  SessionWithUser,
  SessionCloseSummary,
  SessionStatus,
} from "@/types/domain.types";
import type { PaginatedResponse } from "@/types/pagination.types";
import { AppError } from "@/lib/utils/app-error";
import {
  calculateOffset,
  calculatePaginationMeta,
  DEFAULT_PAGE_SIZE,
} from "@/lib/utils/pagination";

type Supa = SupabaseClient<Database>;

const SESSION_SELECT = "*, opened_by_user:users!sessions_opened_by_fkey(id, name)";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const SessionService = {
  async getActive(supabase: Supa): Promise<SessionWithUser | null> {
    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new AppError(error.message, "SESSION_FETCH_FAILED", 500);
    return (data as SessionWithUser | null) ?? null;
  },

  async list(supabase: Supa, status?: SessionStatus): Promise<SessionWithUser[]> {
    let query = supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .order("opened_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new AppError(error.message, "SESSIONS_LIST_FAILED", 500);
    return (data ?? []) as SessionWithUser[];
  },

  async listPaginated(
    supabase: Supa,
    status?: SessionStatus,
    page: number = 1,
    limit: number = DEFAULT_PAGE_SIZE
  ): Promise<PaginatedResponse<SessionWithUser>> {
    // Get total count
    let countQuery = supabase.from("sessions").select("id", { count: "exact" });
    if (status) countQuery = countQuery.eq("status", status);

    const { count, error: countError } = await countQuery;
    if (countError) throw new AppError(countError.message, "SESSIONS_COUNT_FAILED", 500);

    // Get paginated data
    let dataQuery = supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .order("opened_at", { ascending: false });
    if (status) dataQuery = dataQuery.eq("status", status);

    const offset = calculateOffset(page, limit);
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    const { data, error } = await dataQuery;
    if (error) throw new AppError(error.message, "SESSIONS_LIST_FAILED", 500);

    const total = count ?? 0;
    const paginationMeta = calculatePaginationMeta(page, limit, total);

    return {
      data: (data ?? []) as SessionWithUser[],
      pagination: paginationMeta,
    };
  },

  async getById(supabase: Supa, id: string): Promise<SessionWithUser> {
    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new AppError(error.message, "SESSION_FETCH_FAILED", 500);
    if (!data) throw new AppError("Session not found", "SESSION_NOT_FOUND", 404);
    return data as SessionWithUser;
  },

  async open(
    supabase: Supa,
    openedBy: string,
    openingBalance: number
  ): Promise<SessionWithUser> {
    // Business rule: only one session may be open at a time.
    const existing = await this.getActive(supabase);
    if (existing) {
      throw new AppError("A session is already open", "SESSION_ALREADY_OPEN", 409);
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        opened_by: openedBy,
        opening_balance: openingBalance,
        status: "open",
      })
      .select(SESSION_SELECT)
      .single();
    if (error) throw new AppError(error.message, "SESSION_OPEN_FAILED", 400);
    return data as SessionWithUser;
  },

  async close(
    supabase: Supa,
    id: string,
    notes?: string
  ): Promise<{ session: SessionWithUser; summary: SessionCloseSummary }> {
    const session = await this.getById(supabase, id);
    if (session.status !== "open") {
      throw new AppError("Session is not open", "SESSION_NOT_OPEN", 409);
    }

    // Paid orders in this session.
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, total_amount")
      .eq("session_id", id)
      .eq("status", "paid");
    if (ordersError) throw new AppError(ordersError.message, "SESSION_CLOSE_FAILED", 500);

    const orderIds = (orders ?? []).map((o) => o.id);
    const totalOrders = orderIds.length;
    const totalRevenue = round2(
      (orders ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0)
    );

    let cashCollected = 0;
    let cardCollected = 0;
    if (orderIds.length > 0) {
      const { data: payments, error: payError } = await supabase
        .from("payments")
        .select("amount_paid, payment_method_type")
        .in("order_id", orderIds)
        .eq("status", "completed");
      if (payError) throw new AppError(payError.message, "SESSION_CLOSE_FAILED", 500);
      for (const p of payments ?? []) {
        if (p.payment_method_type === "cash") cashCollected += Number(p.amount_paid);
        else if (p.payment_method_type === "card") cardCollected += Number(p.amount_paid);
      }
    }
    cashCollected = round2(cashCollected);
    cardCollected = round2(cardCollected);

    // Closing balance = cash drawer at close = opening balance + cash collected.
    const closingBalance = round2(Number(session.opening_balance) + cashCollected);

    const { data: updated, error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closing_balance: closingBalance,
        notes: notes ?? session.notes,
      })
      .eq("id", id)
      .eq("status", "open") // guard against concurrent close
      .select(SESSION_SELECT)
      .maybeSingle();
    if (updateError) throw new AppError(updateError.message, "SESSION_CLOSE_FAILED", 400);
    if (!updated) throw new AppError("Session is not open", "SESSION_NOT_OPEN", 409);

    const summary: SessionCloseSummary = {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      cash_collected: cashCollected,
      card_collected: cardCollected,
    };
    return { session: updated as SessionWithUser, summary };
  },
};
