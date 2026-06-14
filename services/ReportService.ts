import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { AppError } from "@/lib/utils/app-error";
import { istDateKey, istRangeToUtc } from "@/lib/utils/datetime";
import type { DateRangeInput } from "@/schemas/report.schema";

type Supa = SupabaseClient<Database>;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * The `from`/`to` query params are IST calendar dates (the cafe's day). Convert
 * them to the matching UTC instants so the `timestamptz` window lines up with
 * how staff actually experience the day — not the server's UTC midnight.
 */
function toTimestampRange(from: string, to: string): { from: string; to: string } {
  return istRangeToUtc(from, to);
}

// ─── Shape definitions ────────────────────────────────────────────────────────

export interface DailyRevenueRow {
  date: string; // YYYY-MM-DD
  order_count: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_revenue: number;
}

export interface TopProductRow {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

export interface EmployeeSalesRow {
  employee_id: string;
  employee_name: string;
  order_count: number;
  total_revenue: number;
}

export interface PaymentBreakdownRow {
  payment_method_type: string;
  order_count: number;
  total_amount: number;
}

export interface SessionSummary {
  session_id: string;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  cash_collected: number;
  card_collected: number;
  upi_collected: number;
  total_discount: number;
  total_tax: number;
}

export interface TopCategoryRow {
  category_id: string;
  category_name: string;
  color: string | null;
  quantity_sold: number;
  revenue: number;
}

export interface TopOrderRow {
  order_id: string;
  order_number: string;
  created_at: string;
  customer_name: string | null;
  total_amount: number;
}

/** Cross-report filters (all optional). Period is the date range. */
export interface ReportFilters {
  employeeId?: string;
  sessionId?: string;
  productId?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * The set of PAID order ids in [from,to] honouring the employee/session/product
 * filters. Every report builds on this so filtering is consistent everywhere.
 */
async function scopedPaidOrderIds(
  supabase: Supa,
  range: DateRangeInput,
  filters?: ReportFilters
): Promise<string[]> {
  const ts = toTimestampRange(range.from, range.to);
  let q = supabase
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .gte("created_at", ts.from)
    .lte("created_at", ts.to);
  if (filters?.employeeId) q = q.eq("employee_id", filters.employeeId);
  if (filters?.sessionId) q = q.eq("session_id", filters.sessionId);

  const { data, error } = await q;
  if (error) throw new AppError(error.message, "REPORT_SCOPE_FAILED", 500);
  let ids = (data ?? []).map((o) => o.id);

  if (filters?.productId && ids.length > 0) {
    const { data: its, error: itErr } = await supabase
      .from("order_items")
      .select("order_id")
      .eq("product_id", filters.productId)
      .in("order_id", ids);
    if (itErr) throw new AppError(itErr.message, "REPORT_SCOPE_FAILED", 500);
    const keep = new Set((its ?? []).map((i) => i.order_id));
    ids = ids.filter((id) => keep.has(id));
  }
  return ids;
}

export const ReportService = {
  /**
   * Per-day revenue breakdown for paid orders in [from, to] (inclusive).
   */
  async dailySummary(supabase: Supa, range: DateRangeInput, filters?: ReportFilters): Promise<DailyRevenueRow[]> {
    const ids = await scopedPaidOrderIds(supabase, range, filters);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("orders")
      .select("created_at,subtotal,discount_amount,tax_amount,total_amount")
      .in("id", ids)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(error.message, "REPORT_DAILY_FAILED", 500);

    // Group in-application by IST calendar date (the cafe's day boundary).
    const map = new Map<string, DailyRevenueRow>();
    for (const row of data ?? []) {
      const date = istDateKey(row.created_at);
      const existing = map.get(date) ?? {
        date,
        order_count: 0,
        subtotal: 0,
        discount_amount: 0,
        tax_amount: 0,
        total_revenue: 0,
      };
      existing.order_count += 1;
      existing.subtotal = round2(existing.subtotal + Number(row.subtotal));
      existing.discount_amount = round2(existing.discount_amount + Number(row.discount_amount));
      existing.tax_amount = round2(existing.tax_amount + Number(row.tax_amount));
      existing.total_revenue = round2(existing.total_revenue + Number(row.total_amount));
      map.set(date, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Top products by quantity sold in paid orders within the date range.
   */
  async topProducts(
    supabase: Supa,
    range: DateRangeInput,
    limit = 10,
    filters?: ReportFilters
  ): Promise<TopProductRow[]> {
    const orderIds = await scopedPaidOrderIds(supabase, range, filters);
    if (orderIds.length === 0) return [];

    const { data: items, error: itemErr } = await supabase
      .from("order_items")
      .select("product_id,product_name,quantity,line_total")
      .in("order_id", orderIds);

    if (itemErr) throw new AppError(itemErr.message, "REPORT_TOP_PRODUCTS_FAILED", 500);

    // Aggregate in-app
    const map = new Map<string, TopProductRow>();
    for (const item of items ?? []) {
      const existing = map.get(item.product_id) ?? {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_sold: 0,
        revenue: 0,
      };
      existing.quantity_sold += item.quantity;
      existing.revenue = round2(existing.revenue + Number(item.line_total));
      map.set(item.product_id, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .slice(0, limit);
  },

  /**
   * Sales aggregated by employee for paid orders in [from, to].
   */
  async salesByEmployee(supabase: Supa, range: DateRangeInput, filters?: ReportFilters): Promise<EmployeeSalesRow[]> {
    const ids = await scopedPaidOrderIds(supabase, range, filters);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("orders")
      .select("employee_id,total_amount,employee:users!orders_employee_id_fkey(id,name)")
      .in("id", ids);

    if (error) throw new AppError(error.message, "REPORT_EMPLOYEES_FAILED", 500);

    const map = new Map<string, EmployeeSalesRow>();
    for (const row of data ?? []) {
      const empId = row.employee_id;
      const empName =
        row.employee && !Array.isArray(row.employee) && "name" in row.employee
          ? (row.employee as { name: string }).name
          : empId;
      const existing = map.get(empId) ?? {
        employee_id: empId,
        employee_name: empName,
        order_count: 0,
        total_revenue: 0,
      };
      existing.order_count += 1;
      existing.total_revenue = round2(existing.total_revenue + Number(row.total_amount));
      map.set(empId, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.total_revenue - a.total_revenue);
  },

  /**
   * Payment method breakdown for completed payments in [from, to].
   */
  async paymentBreakdown(supabase: Supa, range: DateRangeInput, filters?: ReportFilters): Promise<PaymentBreakdownRow[]> {
    const ids = await scopedPaidOrderIds(supabase, range, filters);

    const map = new Map<string, PaymentBreakdownRow>();
    const { data, error } = ids.length
      ? await supabase
          .from("payments")
          .select("payment_method_type,amount_paid")
          .eq("status", "completed")
          .in("order_id", ids)
      : { data: [], error: null };

    if (error) throw new AppError(error.message, "REPORT_PAYMENTS_FAILED", 500);

    for (const row of data ?? []) {
      const type = row.payment_method_type;
      const existing = map.get(type) ?? {
        payment_method_type: type,
        order_count: 0,
        total_amount: 0,
      };
      existing.order_count += 1;
      existing.total_amount = round2(existing.total_amount + Number(row.amount_paid));
      map.set(type, existing);
    }

    // Ensure all three types appear (even if zero)
    for (const type of ["cash", "card", "upi"]) {
      if (!map.has(type)) {
        map.set(type, { payment_method_type: type, order_count: 0, total_amount: 0 });
      }
    }

    return Array.from(map.values());
  },

  /**
   * Sales distribution by category (revenue + quantity) for paid orders.
   */
  async topCategories(
    supabase: Supa,
    range: DateRangeInput,
    limit = 8,
    filters?: ReportFilters
  ): Promise<TopCategoryRow[]> {
    const ids = await scopedPaidOrderIds(supabase, range, filters);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("order_items")
      .select("quantity,line_total,product:products(category:categories(id,name,color))")
      .in("order_id", ids);
    if (error) throw new AppError(error.message, "REPORT_TOP_CATEGORIES_FAILED", 500);

    const map = new Map<string, TopCategoryRow>();
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const product = row.product as { category?: { id: string; name: string; color: string | null } } | null;
      const cat = product?.category;
      const key = cat?.id ?? "uncategorized";
      const existing = map.get(key) ?? {
        category_id: key,
        category_name: cat?.name ?? "Uncategorized",
        color: cat?.color ?? null,
        quantity_sold: 0,
        revenue: 0,
      };
      existing.quantity_sold += Number(row.quantity) || 0;
      existing.revenue = round2(existing.revenue + Number(row.line_total));
      map.set(key, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },

  /**
   * Highest-value paid orders within the range/filters.
   */
  async topOrders(
    supabase: Supa,
    range: DateRangeInput,
    limit = 10,
    filters?: ReportFilters
  ): Promise<TopOrderRow[]> {
    const ids = await scopedPaidOrderIds(supabase, range, filters);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("orders")
      .select("id,order_number,created_at,total_amount,customer:customers(name)")
      .in("id", ids)
      .order("total_amount", { ascending: false })
      .limit(limit);
    if (error) throw new AppError(error.message, "REPORT_TOP_ORDERS_FAILED", 500);

    return ((data ?? []) as Array<Record<string, unknown>>).map((o) => {
      const customer = o.customer as { name?: string } | null;
      return {
        order_id: o.id as string,
        order_number: o.order_number as string,
        created_at: o.created_at as string,
        customer_name: customer?.name ?? null,
        total_amount: Number(o.total_amount),
      };
    });
  },

  /**
   * Aggregated summary for a single session.
   */
  async sessionSummary(supabase: Supa, sessionId: string): Promise<SessionSummary> {
    // Verify session exists
    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessErr) throw new AppError(sessErr.message, "REPORT_SESSION_FAILED", 500);
    if (!session) throw new AppError("Session not found", "SESSION_NOT_FOUND", 404);

    const { data: orders, error: ordErr } = await supabase
      .from("orders")
      .select("id,status,total_amount,discount_amount,tax_amount")
      .eq("session_id", sessionId);

    if (ordErr) throw new AppError(ordErr.message, "REPORT_SESSION_FAILED", 500);

    const paidOrderIds = (orders ?? [])
      .filter((o) => o.status === "paid")
      .map((o) => o.id);

    let cashCollected = 0;
    let cardCollected = 0;
    let upiCollected = 0;

    if (paidOrderIds.length > 0) {
      const { data: payments, error: payErr } = await supabase
        .from("payments")
        .select("payment_method_type,amount_paid")
        .in("order_id", paidOrderIds)
        .eq("status", "completed");

      if (payErr) throw new AppError(payErr.message, "REPORT_SESSION_FAILED", 500);

      for (const p of payments ?? []) {
        const amt = Number(p.amount_paid);
        if (p.payment_method_type === "cash") cashCollected = round2(cashCollected + amt);
        else if (p.payment_method_type === "card") cardCollected = round2(cardCollected + amt);
        else if (p.payment_method_type === "upi") upiCollected = round2(upiCollected + amt);
      }
    }

    const paidOrders = (orders ?? []).filter((o) => o.status === "paid");
    const totalRevenue = paidOrders.reduce((sum, o) => round2(sum + Number(o.total_amount)), 0);
    const totalDiscount = paidOrders.reduce(
      (sum, o) => round2(sum + Number(o.discount_amount)),
      0
    );
    const totalTax = paidOrders.reduce((sum, o) => round2(sum + Number(o.tax_amount)), 0);

    return {
      session_id: sessionId,
      total_orders: (orders ?? []).length,
      paid_orders: paidOrders.length,
      total_revenue: totalRevenue,
      cash_collected: cashCollected,
      card_collected: cardCollected,
      upi_collected: upiCollected,
      total_discount: totalDiscount,
      total_tax: totalTax,
    };
  },
};
