"use client";

import * as XLSX from "xlsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Banknote,
  Clock,
  CreditCard,
  Download,
  Layers,
  MapPin,
  Printer,
  Receipt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { IST_TZ, addIstDays, formatDateTimeIST, istDateKey, istToday } from "@/lib/utils/datetime";
import type {
  DailyRevenueRow,
  EmployeeSalesRow,
  PaymentBreakdownRow,
  TopCategoryRow,
  TopOrderRow,
  TopProductRow,
} from "@/services/ReportService";
import type { OrderWithItems, ProductWithCategory, SessionWithUser, User } from "@/types/domain.types";

type Period = "today" | "week" | "month" | "custom";

const PERIOD_LABEL: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  custom: "Custom range",
};

function rangeFor(period: Exclude<Period, "custom">): { from: string; to: string } {
  const to = istToday();
  const span = period === "week" ? 6 : period === "month" ? 29 : 0;
  return { from: addIstDays(to, -span), to };
}


/** Continuous date list from..to (inclusive), YYYY-MM-DD.
 *  UTC-anchored so keys match the daily-summary dates (created_at UTC) exactly,
 *  regardless of the viewer's timezone. */
function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function compactCurrency(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function shortLabel(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function fmtTime(iso: string): string {
  return formatDateTimeIST(iso);
}

const PAY_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  cash: { label: "Cash", color: "#16a34a", icon: Banknote },
  card: { label: "Card", color: "#2563eb", icon: CreditCard },
  upi: { label: "UPI", color: "#7c3aed", icon: Smartphone },
  razorpay: { label: "Razorpay", color: "#163300", icon: CreditCard },
};

/** Convert ISO timestamp to IST hour 0-23 */
function istHour(iso: string): number {
  return new Date(new Date(iso).getTime() + 5.5 * 3600000).getUTCHours();
}
/** Convert ISO timestamp to IST day-of-week index 0 (Sun) – 6 (Sat) */
function istDow(iso: string): number {
  return new Date(new Date(iso).getTime() + 5.5 * 3600000).getUTCDay();
}
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ReportsPage(): React.ReactElement {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("week");
  const [customFrom, setCustomFrom] = useState(() => rangeFor("week").from);
  const [customTo, setCustomTo] = useState(() => rangeFor("week").to);

  // Cross-report filters
  const [employeeId, setEmployeeId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [productId, setProductId] = useState("");

  // Filter option lists (loaded once)
  const [empOptions, setEmpOptions] = useState<User[]>([]);
  const [sessionOptions, setSessionOptions] = useState<SessionWithUser[]>([]);
  const [productOptions, setProductOptions] = useState<ProductWithCategory[]>([]);

  const [daily, setDaily] = useState<DailyRevenueRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategoryRow[]>([]);
  const [topOrders, setTopOrders] = useState<TopOrderRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeSalesRow[]>([]);
  const [payments, setPayments] = useState<PaymentBreakdownRow[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(
    () => (period === "custom" ? { from: customFrom, to: customTo } : rangeFor(period)),
    [period, customFrom, customTo]
  );

  const filterQs = useMemo(() => {
    const p = new URLSearchParams();
    if (employeeId) p.set("employee_id", employeeId);
    if (sessionId) p.set("session_id", sessionId);
    if (productId) p.set("product_id", productId);
    const s = p.toString();
    return s ? `&${s}` : "";
  }, [employeeId, sessionId, productId]);

  // Load filter option lists once
  useEffect(() => {
    void Promise.all([
      apiGet<User[]>("/api/users").catch(() => []),
      apiGet<SessionWithUser[]>("/api/sessions").catch(() => []),
      apiGet<ProductWithCategory[]>("/api/products").catch(() => []),
    ]).then(([u, s, pr]) => {
      setEmpOptions((u ?? []).filter((x) => x.role !== "customer" && x.role !== "kitchen"));
      setSessionOptions(s ?? []);
      setProductOptions(pr ?? []);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = `from=${range.from}&to=${range.to}${filterQs}`;
    try {
      const [d, tp, tc, to, emp, pay, ord] = await Promise.all([
        apiGet<DailyRevenueRow[]>(`/api/reports/daily?${qs}`),
        apiGet<TopProductRow[]>(`/api/reports/top-products?${qs}&limit=10`),
        apiGet<TopCategoryRow[]>(`/api/reports/top-categories?${qs}&limit=8`),
        apiGet<TopOrderRow[]>(`/api/reports/top-orders?${qs}&limit=8`),
        apiGet<EmployeeSalesRow[]>(`/api/reports/employees?${qs}`),
        apiGet<PaymentBreakdownRow[]>(`/api/reports/payments?${qs}`),
        apiGet<OrderWithItems[]>(`/api/orders`),
      ]);
      setDaily(d);
      setTopProducts(tp);
      setTopCategories(tc);
      setTopOrders(to);
      setEmployees(emp);
      setPayments(pay);
      setOrders(ord);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, filterQs, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilters = !!(employeeId || sessionId || productId);
  function clearFilters(): void {
    setEmployeeId("");
    setSessionId("");
    setProductId("");
  }

  function exportExcel(): void {
    const wb = XLSX.utils.book_new();
    const generatedAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });

    // ── 1. Summary ──────────────────────────────────────────────────────────
    const totalRev = daily.reduce((s, r) => s + r.total_revenue, 0);
    const totalOrd = daily.reduce((s, r) => s + r.order_count, 0);
    const totalDisc = daily.reduce((s, r) => s + r.discount_amount, 0);
    const totalTax = daily.reduce((s, r) => s + r.tax_amount, 0);
    const totalSub = daily.reduce((s, r) => s + r.subtotal, 0);
    const avgOrdVal = totalOrd > 0 ? totalRev / totalOrd : 0;
    const payTotal2 = payments.reduce((s, p) => s + p.total_amount, 0);
    const activeEmployees = employees.filter((e) => e.order_count > 0).length;

    const summaryData = [
      ["NexaBrew — Business Report", ""],
      ["Report Period", `${range.from}  →  ${range.to}`],
      ["Generated At", generatedAt],
      ["Active Filters", activeFilters ? [employeeId && "Employee", sessionId && "Session", productId && "Product"].filter(Boolean).join(", ") : "None"],
      ["", ""],
      ["── Revenue KPIs", ""],
      ["Total Revenue (₹)", totalRev],
      ["Gross Subtotal (₹)", totalSub],
      ["Total Discounts Given (₹)", totalDisc],
      ["Total Tax Collected (₹)", totalTax],
      ["", ""],
      ["── Orders", ""],
      ["Total Paid Orders", totalOrd],
      ["Average Order Value (₹)", Number(avgOrdVal.toFixed(2))],
      ["Largest Single Order (₹)", topOrders.length ? Math.max(...topOrders.map((o) => Number(o.total_amount))) : 0],
      ["", ""],
      ["── Products", ""],
      ["Top Product", topProducts[0]?.product_name ?? "—"],
      ["Top Product Units Sold", topProducts[0]?.quantity_sold ?? 0],
      ["Top Product Revenue (₹)", topProducts[0]?.revenue ?? 0],
      ["", ""],
      ["── Payments", ""],
      ["Total Payments Collected (₹)", payTotal2],
      ["Payment Methods Used", payments.length],
      ["Top Payment Method", payments.reduce<PaymentBreakdownRow | null>((a, b) => (b.total_amount > (a?.total_amount ?? 0) ? b : a), null)?.payment_method_type ?? "—"],
      ["", ""],
      ["── Staff", ""],
      ["Active Employees", activeEmployees],
      ["Top Employee", employees[0]?.employee_name ?? "—"],
      ["Top Employee Orders", employees[0]?.order_count ?? 0],
      ["Top Employee Revenue (₹)", employees[0]?.total_revenue ?? 0],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 34 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // ── 2. Daily Revenue ─────────────────────────────────────────────────────
    const dailyHeaders = ["Date", "Day", "Paid Orders", "Gross Subtotal (₹)", "Discounts (₹)", "Tax (₹)", "Net Revenue (₹)", "Avg Order Value (₹)"];
    const dailyRows = daily.map((r) => [
      r.date,
      new Date(r.date + "T12:00:00Z").toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" }),
      r.order_count,
      Number(Number(r.subtotal).toFixed(2)),
      Number(Number(r.discount_amount).toFixed(2)),
      Number(Number(r.tax_amount).toFixed(2)),
      Number(Number(r.total_revenue).toFixed(2)),
      r.order_count > 0 ? Number((r.total_revenue / r.order_count).toFixed(2)) : 0,
    ]);
    // Totals row
    dailyRows.push([
      "TOTAL", "",
      totalOrd,
      Number(totalSub.toFixed(2)),
      Number(totalDisc.toFixed(2)),
      Number(totalTax.toFixed(2)),
      Number(totalRev.toFixed(2)),
      Number(avgOrdVal.toFixed(2)),
    ]);
    const wsDaily = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]);
    wsDaily["!cols"] = [{ wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Revenue");

    // ── 3. Product Performance ───────────────────────────────────────────────
    const prodTotalRev = topProducts.reduce((s, p) => s + p.revenue, 0);
    const prodHeaders = ["Rank", "Product", "Units Sold", "Revenue (₹)", "Revenue Share (%)", "Avg Unit Price (₹)"];
    const prodRows = topProducts.map((p, i) => [
      i + 1,
      p.product_name,
      p.quantity_sold,
      Number(p.revenue.toFixed(2)),
      prodTotalRev > 0 ? Number(((p.revenue / prodTotalRev) * 100).toFixed(1)) : 0,
      p.quantity_sold > 0 ? Number((p.revenue / p.quantity_sold).toFixed(2)) : 0,
    ]);
    const wsProd = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
    wsProd["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsProd, "Product Performance");

    // ── 4. Category Analysis ─────────────────────────────────────────────────
    const catTotalRev = topCategories.reduce((s, c) => s + c.revenue, 0);
    const catHeaders = ["Category", "Units Sold", "Revenue (₹)", "Revenue Share (%)"];
    const catRows = topCategories.map((c) => [
      c.category_name,
      c.quantity_sold,
      Number(c.revenue.toFixed(2)),
      catTotalRev > 0 ? Number(((c.revenue / catTotalRev) * 100).toFixed(1)) : 0,
    ]);
    const wsCat = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
    wsCat["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsCat, "Category Analysis");

    // ── 5. Employee Performance ──────────────────────────────────────────────
    const empTotalRev = employees.reduce((s, e) => s + e.total_revenue, 0);
    const empHeaders = ["Employee", "Paid Orders", "Revenue (₹)", "Revenue Share (%)", "Avg Order Value (₹)"];
    const empRows = employees.map((e) => [
      e.employee_name,
      e.order_count,
      Number(e.total_revenue.toFixed(2)),
      empTotalRev > 0 ? Number(((e.total_revenue / empTotalRev) * 100).toFixed(1)) : 0,
      e.order_count > 0 ? Number((e.total_revenue / e.order_count).toFixed(2)) : 0,
    ]);
    const wsEmp = XLSX.utils.aoa_to_sheet([empHeaders, ...empRows]);
    wsEmp["!cols"] = [{ wch: 24 }, { wch: 13 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsEmp, "Employee Performance");

    // ── 6. Payment Mix ───────────────────────────────────────────────────────
    const payHeaders = ["Payment Method", "Transactions", "Amount Collected (₹)", "Share of Revenue (%)", "Avg Transaction (₹)"];
    const payRows = payments.map((p) => [
      p.payment_method_type.toUpperCase(),
      p.order_count,
      Number(p.total_amount.toFixed(2)),
      payTotal2 > 0 ? Number(((p.total_amount / payTotal2) * 100).toFixed(1)) : 0,
      p.order_count > 0 ? Number((p.total_amount / p.order_count).toFixed(2)) : 0,
    ]);
    const wsPay = XLSX.utils.aoa_to_sheet([payHeaders, ...payRows]);
    wsPay["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsPay, "Payment Mix");

    // ── 7. Order History ─────────────────────────────────────────────────────
    const ordHeaders = ["Order #", "Date", "Time (IST)", "Customer", "Table", "Items", "Subtotal (₹)", "Discount (₹)", "Tax (₹)", "Total (₹)", "Status"];
    const ordRows = history.map((o) => {
      const dt = new Date(o.created_at);
      return [
        o.order_number,
        dt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }),
        dt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }),
        o.customer?.name ?? "Walk-in",
        o.table?.table_number ?? "—",
        o.items.length,
        Number(Number(o.subtotal).toFixed(2)),
        Number(Number(o.discount_amount).toFixed(2)),
        Number(Number(o.tax_amount).toFixed(2)),
        Number(Number(o.total_amount).toFixed(2)),
        o.status,
      ];
    });
    const wsOrd = XLSX.utils.aoa_to_sheet([ordHeaders, ...ordRows]);
    wsOrd["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsOrd, "Order History");

    // ── 8. Hourly Heatmap ────────────────────────────────────────────────────
    const hourlyHeaders = ["Hour (IST)", "Orders", "Revenue (₹)", "Avg Order Value (₹)", "% of Day Revenue"];
    const hourlyTotalRev = hourlyData.reduce((s, h) => s + h.revenue, 0);
    const hourlyRows = hourlyData.map((h) => [
      h.hour,
      h.orders,
      Number(h.revenue.toFixed(2)),
      h.orders > 0 ? Number((h.revenue / h.orders).toFixed(2)) : 0,
      hourlyTotalRev > 0 ? Number(((h.revenue / hourlyTotalRev) * 100).toFixed(1)) : 0,
    ]);
    const wsHourly = XLSX.utils.aoa_to_sheet([hourlyHeaders, ...hourlyRows]);
    wsHourly["!cols"] = [{ wch: 13 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsHourly, "Hourly Heatmap");

    // ── 9. Day of Week ───────────────────────────────────────────────────────
    const dowHeaders = ["Day", "Orders", "Revenue (₹)", "Avg Order Value (₹)"];
    const dowRows = dowData.map((d) => [
      d.day,
      d.orders,
      Number(d.revenue.toFixed(2)),
      d.orders > 0 ? Number((d.revenue / d.orders).toFixed(2)) : 0,
    ]);
    const wsDow = XLSX.utils.aoa_to_sheet([dowHeaders, ...dowRows]);
    wsDow["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsDow, "Day of Week");

    // ── 10. Customer Loyalty ─────────────────────────────────────────────────
    const custHeaders = ["Customer", "Email", "Orders", "Total Spent (₹)", "Avg Order (₹)", "First Visit", "Last Visit", "New vs Repeat"];
    const custRows = customerInsights.map((c) => [
      c.name,
      c.email,
      c.orders,
      Number(c.revenue.toFixed(2)),
      Number((c.revenue / c.orders).toFixed(2)),
      new Date(c.firstOrder).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }),
      new Date(c.lastOrder).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }),
      c.orders > 1 ? "Repeat" : "New",
    ]);
    const wsCust = XLSX.utils.aoa_to_sheet([custHeaders, ...custRows]);
    wsCust["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 9 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsCust, "Customer Loyalty");

    // ── 11. Table Utilization ────────────────────────────────────────────────
    const tblHeaders = ["Table", "Orders", "Revenue (₹)", "Avg Order (₹)", "Revenue Share (%)"];
    const tblRows = tableInsights.map((t) => [
      `Table ${t.table}`,
      t.orders,
      Number(t.revenue.toFixed(2)),
      t.orders > 0 ? Number((t.revenue / t.orders).toFixed(2)) : 0,
      t.share,
    ]);
    const wsTbl = XLSX.utils.aoa_to_sheet([tblHeaders, ...tblRows]);
    wsTbl["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsTbl, "Table Utilization");

    // ── 12. Coupon Impact ────────────────────────────────────────────────────
    const cpnHeaders = ["Coupon Code", "Discount Type", "Discount Value", "Times Used", "Total Discount Given (₹)", "Avg Discount per Use (₹)"];
    const cpnRows = couponInsights.map((c) => [
      c.code,
      c.type,
      c.type === "percentage" ? `${c.value}%` : `₹${c.value}`,
      c.timesUsed,
      Number(c.totalDiscount.toFixed(2)),
      Number((c.totalDiscount / c.timesUsed).toFixed(2)),
    ]);
    const wsCpn = XLSX.utils.aoa_to_sheet([cpnHeaders, ...cpnRows]);
    wsCpn["!cols"] = [{ wch: 16 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsCpn, "Coupon Impact");

    // ── 13. Line Item Detail ─────────────────────────────────────────────────
    const lineHeaders = ["Order #", "Date", "Customer", "Table", "Product", "Qty", "Unit Price (₹)", "Line Total (₹)", "Coupon", "Employee"];
    const lineRows: (string | number)[][] = [];
    history.forEach((o) => {
      const dt = new Date(o.created_at);
      const dateStr = dt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
      o.items.forEach((it) => {
        lineRows.push([
          o.order_number,
          dateStr,
          o.customer?.name ?? "Walk-in",
          o.table?.table_number ?? "—",
          it.product_name,
          it.quantity,
          Number(Number(it.unit_price).toFixed(2)),
          Number(Number(it.line_total).toFixed(2)),
          o.coupon?.code ?? "",
          o.employee?.name ?? "",
        ]);
      });
    });
    const wsLine = XLSX.utils.aoa_to_sheet([lineHeaders, ...lineRows]);
    wsLine["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 8 }, { wch: 28 }, { wch: 6 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsLine, "Line Item Detail");

    // ── Download ─────────────────────────────────────────────────────────────
    XLSX.writeFile(wb, `NexaBrew_Report_${range.from}_to_${range.to}.xlsx`);
  }


  const totalOrders = daily.reduce((s, r) => s + r.order_count, 0);
  const totalRevenue = daily.reduce((s, r) => s + r.total_revenue, 0);
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const topProduct = topProducts[0];

  // Fill the whole range so the trend spans the period (no lonely dots).
  const byDate = new Map(daily.map((r) => [r.date, r]));
  const chartData = dateRange(range.from, range.to).map((d) => ({
    date: shortLabel(d),
    revenue: byDate.get(d)?.total_revenue ?? 0,
    orders: byDate.get(d)?.order_count ?? 0,
  }));
  const ordersSpark = chartData.map((c) => c.orders);

  // Paid orders within the selected period → Order History.
  const history = orders
    .filter((o) => o.status === "paid")
    .filter((o) => {
      const d = istDateKey(o.created_at);
      return d >= range.from && d <= range.to;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // ── Advanced analytics (all derived from `history`) ───────────────────────

  const hourlyData = useMemo(() => {
    const map = new Map<number, { orders: number; revenue: number }>();
    for (let h = 0; h < 24; h++) map.set(h, { orders: 0, revenue: 0 });
    history.forEach((o) => {
      const h = istHour(o.created_at);
      const e = map.get(h)!;
      e.orders += 1;
      e.revenue = Math.round((e.revenue + Number(o.total_amount)) * 100) / 100;
    });
    return Array.from(map, ([hour, v]) => ({
      hour: `${String(hour).padStart(2, "0")}:00`,
      ...v,
    }));
  }, [history]);

  const dowData = useMemo(() => {
    const map = new Map<number, { orders: number; revenue: number }>();
    for (let d = 0; d < 7; d++) map.set(d, { orders: 0, revenue: 0 });
    history.forEach((o) => {
      const d = istDow(o.created_at);
      const e = map.get(d)!;
      e.orders += 1;
      e.revenue = Math.round((e.revenue + Number(o.total_amount)) * 100) / 100;
    });
    return Array.from(map, ([dow, v]) => ({ day: DOW_LABELS[dow], ...v }));
  }, [history]);

  const customerInsights = useMemo(() => {
    const map = new Map<string, { name: string; email: string; orders: number; revenue: number; firstOrder: string; lastOrder: string }>();
    history.forEach((o) => {
      if (!o.customer) return;
      const key = o.customer.id;
      const e = map.get(key) ?? {
        name: o.customer.name,
        email: o.customer.email ?? "",
        orders: 0,
        revenue: 0,
        firstOrder: o.created_at,
        lastOrder: o.created_at,
      };
      e.orders += 1;
      e.revenue = Math.round((e.revenue + Number(o.total_amount)) * 100) / 100;
      if (o.created_at < e.firstOrder) e.firstOrder = o.created_at;
      if (o.created_at > e.lastOrder) e.lastOrder = o.created_at;
      map.set(key, e);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [history]);

  const tableInsights = useMemo(() => {
    const map = new Map<number, { orders: number; revenue: number }>();
    history.forEach((o) => {
      if (!o.table) return;
      const t = o.table.table_number;
      const e = map.get(t) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue = Math.round((e.revenue + Number(o.total_amount)) * 100) / 100;
      map.set(t, e);
    });
    const totalTableRev = Array.from(map.values()).reduce((s, v) => s + v.revenue, 0);
    return Array.from(map, ([table, v]) => ({
      table,
      ...v,
      share: totalTableRev > 0 ? Math.round((v.revenue / totalTableRev) * 1000) / 10 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [history]);

  const couponInsights = useMemo(() => {
    const map = new Map<string, { code: string; type: string; value: number; timesUsed: number; totalDiscount: number }>();
    history.forEach((o) => {
      if (!o.coupon || !Number(o.discount_amount)) return;
      const key = o.coupon.id;
      const e = map.get(key) ?? {
        code: o.coupon.code,
        type: o.coupon.discount_type ?? "",
        value: Number(o.coupon.discount_value ?? 0),
        timesUsed: 0,
        totalDiscount: 0,
      };
      e.timesUsed += 1;
      e.totalDiscount = Math.round((e.totalDiscount + Number(o.discount_amount)) * 100) / 100;
      map.set(key, e);
    });
    return Array.from(map.values()).sort((a, b) => b.totalDiscount - a.totalDiscount);
  }, [history]);

  const maxProductRev = Math.max(...topProducts.map((p) => p.revenue), 1);
  const maxEmpRev = Math.max(...employees.map((e) => e.total_revenue), 1);
  const payTotal = payments.reduce((s, p) => s + p.total_amount, 0);

  // ── Quick insights (human-friendly highlights from loaded data) ──
  const busiest = chartData.reduce(
    (a, b) => (b.revenue > a.revenue ? b : a),
    chartData[0] ?? { date: "—", revenue: 0, orders: 0 }
  );
  const topPay = payments.reduce<PaymentBreakdownRow | null>(
    (a, b) => (b.total_amount > (a?.total_amount ?? 0) ? b : a),
    null
  );
  const insights = [
    { label: "Busiest day", value: totalOrders ? busiest.date : "—", sub: totalOrders ? `${compactCurrency(busiest.revenue)} earned` : "no sales yet" },
    { label: "Bestseller", value: topProduct?.product_name ?? "—", sub: topProduct ? `${topProduct.quantity_sold} sold` : "no sales yet" },
    { label: "Most-used payment", value: topPay ? (PAY_META[topPay.payment_method_type]?.label ?? topPay.payment_method_type) : "—", sub: topPay ? `${compactCurrency(topPay.total_amount)} collected` : "no payments" },
  ];

  return (
    <div className="space-y-6 p-6">
      <style>{`@media print { aside, .no-print { display: none !important; } body { background: #fff; } }`}</style>

      <PageHeader
        title="Reports"
        subtitle={`${range.from} → ${range.to}`}
        action={
          <div className="no-print flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={loading}>
              <Download className="mr-1.5 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={loading}>
              <Printer className="mr-1.5 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      {/* Filter toolbar */}
      <div className="no-print flex flex-wrap items-center gap-3 rounded-wiseCard border border-wise-border bg-white p-3 shadow-wiseCard">
        <div className="flex rounded-lg border border-wise-border p-0.5">
          {(["today", "week", "month", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
                period === p ? "bg-wise-primary text-wise-ink shadow-sm" : "text-wise-body hover:bg-wise-canvas-soft hover:text-wise-ink"
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-wise border border-wise-border bg-white px-2.5 py-1.5 text-wise-ink focus:border-wise-primary focus:outline-none focus:ring-2 focus:ring-ring/40" />
            <span className="text-wise-mute">→</span>
            <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className="rounded-wise border border-wise-border bg-white px-2.5 py-1.5 text-wise-ink focus:border-wise-primary focus:outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {[
            { v: employeeId, set: setEmployeeId, ph: "All employees", opts: empOptions.map((e) => ({ id: e.id, label: e.name })) },
            { v: sessionId, set: setSessionId, ph: "All sessions", opts: sessionOptions.map((s) => ({ id: s.id, label: `${new Date(s.opened_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: IST_TZ })} · ${s.opened_by_user?.name ?? "—"}` })) },
            { v: productId, set: setProductId, ph: "All products", opts: productOptions.map((p) => ({ id: p.id, label: p.name })) },
          ].map((f, i) => (
            <select
              key={i}
              value={f.v}
              onChange={(e) => f.set(e.target.value)}
              className="rounded-wise border border-wise-border bg-white px-2.5 py-1.5 text-sm text-wise-ink focus:border-wise-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="">{f.ph}</option>
              {f.opts.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          ))}
          {activeFilters && (
            <button onClick={clearFilters} className="rounded-wisePill px-2.5 py-1.5 text-sm font-medium text-wise-ink-deep hover:bg-wise-primary-pale">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Hero: total revenue for the period (matches dashboard) */}
      <section className="relative overflow-hidden rounded-wiseCard bg-wise-ink px-6 py-7 shadow-wiseCard sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-wise-primary/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-wise-primary motion-safe:animate-pulse" />
            Total revenue · {PERIOD_LABEL[period]}{activeFilters ? " · filtered" : ""}
          </div>
          <p className="mt-2 font-display text-5xl font-extrabold leading-none tracking-tight text-wise-primary sm:text-6xl">
            {loading ? "—" : formatCurrency(totalRevenue)}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-sm text-white/60">
            <span><span className="font-semibold text-white">{totalOrders}</span> orders</span>
            <span><span className="font-semibold text-white">{totalOrders ? formatCurrency(avgOrder) : "—"}</span> avg order</span>
            <span><span className="font-semibold text-white">{topProduct?.product_name ?? "—"}</span> top product</span>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Orders" value={String(totalOrders)} sub={`in ${chartData.length} days`}
          icon={ShoppingCart} accent="#2ead4b" tint="from-wise-primary-pale" spark={ordersSpark} loading={loading} delay={0}
        />
        <StatCard
          title="Avg Order Value" value={totalOrders ? formatCurrency(avgOrder) : "—"} sub={totalOrders ? `over ${totalOrders} orders` : "no orders"}
          icon={TrendingUp} accent="#7c3aed" tint="from-violet-50" loading={loading} delay={120}
        />
        <StatCard
          title="Top Product" value={topProduct?.product_name ?? "—"} sub={topProduct ? `${topProduct.quantity_sold} sold` : "no sales"}
          icon={Trophy} accent="#d97706" tint="from-amber-50" loading={loading} delay={180}
        />
      </div>

      {/* Quick insights */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {insights.map((ins) => (
          <div
            key={ins.label}
            className="rounded-wiseCard border border-wise-border bg-white px-4 py-3 shadow-wiseCard transition-transform duration-200 hover:-translate-y-0.5"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-wise-mute">
              <Sparkles className="h-3 w-3 text-wise-ink-deep" /> {ins.label}
            </p>
            <p className="mt-1 truncate font-display text-lg font-extrabold text-wise-ink">{ins.value}</p>
            <p className="text-xs text-wise-body">{ins.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <Card className="overflow-hidden border-wise-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <p className="mt-0.5 text-xs text-wise-mute">Daily revenue & order volume</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-wise-body">
              <span className="h-2.5 w-2.5 rounded-full bg-wise-primary" /> Revenue
            </span>
            <span className="flex items-center gap-1.5 text-wise-body">
              <span className="h-2.5 w-2.5 rounded-sm bg-wise-primary-pale" /> Orders
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[260px] w-full animate-pulse rounded-lg bg-wise-canvas-soft" />
          ) : totalOrders === 0 ? (
            <EmptyState icon={BarChart3} text="No paid orders in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2ead4b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2ead4b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#d7ddd2" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#868685" fontSize={11} tickLine={false} axisLine={false} />
                {/* Revenue scales on its own (left) axis; orders on a hidden
                    right axis so a quiet day's bars don't crush the line. */}
                <YAxis yAxisId="rev" stroke="#868685" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compactCurrency} width={48} />
                <YAxis yAxisId="ord" orientation="right" hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#e8ebe6" }} />
                <Bar yAxisId="ord" dataKey="orders" fill="#c5edab" radius={[3, 3, 0, 0]} barSize={18} />
                <Area
                  yAxisId="rev"
                  type="monotone" dataKey="revenue" stroke="#2ead4b" strokeWidth={2.5}
                  fill="url(#revFill)" dot={{ r: 2.5, fill: "#2ead4b", strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  animationDuration={700}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top products + employees */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-wise-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Top Products</CardTitle></CardHeader>
          <CardContent className="space-y-1 pt-2">
            {loading ? (
              <SkeletonRows />
            ) : topProducts.length === 0 ? (
              <EmptyState icon={ShoppingCart} text="No sales yet." compact />
            ) : (
              topProducts.map((p, i) => (
                <div
                  key={p.product_id}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-wise-canvas-soft motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
                >
                  <RankBadge rank={i + 1} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-wise-ink">{p.product_name}</span>
                      <span className="shrink-0 text-sm font-semibold text-wise-body">{formatCurrency(p.revenue)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wise-canvas-soft">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-wise-primary to-wise-primary transition-[width] duration-700 ease-out"
                          style={{ width: `${(p.revenue / maxProductRev) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs text-wise-mute">{p.quantity_sold}×</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-wise-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Sales by Employee</CardTitle></CardHeader>
          <CardContent className="space-y-1 pt-2">
            {loading ? (
              <SkeletonRows />
            ) : employees.length === 0 ? (
              <EmptyState icon={ShoppingCart} text="No sales yet." compact />
            ) : (
              employees.map((e, i) => (
                <div
                  key={e.employee_id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-wise-canvas-soft motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
                >
                  <Avatar name={e.employee_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-wise-ink">{e.employee_name}</span>
                      <span className="shrink-0 text-sm font-semibold text-wise-body">{formatCurrency(e.total_revenue)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wise-canvas-soft">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600 transition-[width] duration-700 ease-out"
                          style={{ width: `${(e.total_revenue / maxEmpRev) * 100}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs text-wise-mute">{e.order_count} ord</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top categories + Top orders (spec §2.9) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Categories — chart + ranked list */}
        <Card className="border-wise-border shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Layers className="h-4 w-4 text-wise-ink-deep" />
            <CardTitle className="text-base">Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-44 w-full animate-pulse rounded-lg bg-wise-canvas-soft" />
            ) : topCategories.length === 0 ? (
              <EmptyState icon={Layers} text="No category sales yet." compact />
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative shrink-0">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie data={topCategories} dataKey="revenue" nameKey="category_name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                        {topCategories.map((c) => (
                          <Cell key={c.category_id} fill={c.color ?? "#9fe870"} />
                        ))}
                      </Pie>
                      <Tooltip content={<CategoryTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase tracking-wide text-wise-mute">Cats</span>
                    <span className="text-sm font-bold text-wise-ink">{topCategories.length}</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {topCategories.map((c) => {
                    const max = Math.max(...topCategories.map((x) => x.revenue), 1);
                    return (
                      <div key={c.category_id} className="flex items-center gap-2.5 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? "#9fe870" }} />
                        <span className="w-24 shrink-0 truncate text-wise-ink">{c.category_name}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-wise-canvas-soft">
                          <div className="h-full rounded-full bg-wise-primary" style={{ width: `${(c.revenue / max) * 100}%` }} />
                        </div>
                        <span className="w-16 shrink-0 text-right font-semibold text-wise-ink">{formatCurrency(c.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Orders — highest-value */}
        <Card className="border-wise-border shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Receipt className="h-4 w-4 text-wise-ink-deep" />
            <CardTitle className="text-base">Top Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4"><SkeletonRows /></div>
            ) : topOrders.length === 0 ? (
              <EmptyState icon={Receipt} text="No orders in this range." compact />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wise-border text-xs uppercase tracking-wider text-wise-mute">
                    <th className="px-4 py-2 text-left">Order</th>
                    <th className="px-4 py-2 text-left">Customer</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topOrders.map((o) => (
                    <tr key={o.order_id} className="border-b border-wise-border transition-colors last:border-0 hover:bg-wise-canvas-soft">
                      <td className="px-4 py-2.5 font-medium text-wise-ink">
                        {o.order_number}
                        <span className="ml-1.5 text-xs text-wise-mute">{fmtTime(o.created_at)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-wise-body">{o.customer_name ?? "Walk-in"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-wise-ink">{formatCurrency(o.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment breakdown (donut) + Order history */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-wise-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Payment Mix</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="mx-auto h-40 w-40 animate-pulse rounded-full bg-wise-canvas-soft" />
            ) : payments.length === 0 ? (
              <EmptyState icon={CreditCard} text="No payments yet." compact />
            ) : (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={payments} dataKey="total_amount" nameKey="payment_method_type"
                        innerRadius={50} outerRadius={75} paddingAngle={2} stroke="none" animationDuration={600}
                      >
                        {payments.map((p) => (
                          <Cell key={p.payment_method_type} fill={PAY_META[p.payment_method_type]?.color ?? "#868685"} />
                        ))}
                      </Pie>
                      <Tooltip content={<PayTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase tracking-wide text-wise-mute">Total</span>
                    <span className="text-sm font-bold text-wise-ink">{compactCurrency(payTotal)}</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {payments.map((p) => {
                    const meta = PAY_META[p.payment_method_type] ?? { label: p.payment_method_type, color: "#868685", icon: CreditCard };
                    const Icon = meta.icon;
                    const pctShare = payTotal > 0 ? Math.round((p.total_amount / payTotal) * 100) : 0;
                    return (
                      <div key={p.payment_method_type} className="flex items-center gap-2 text-sm">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 text-wise-body">{meta.label}</span>
                        <span className="text-xs text-wise-mute">{pctShare}%</span>
                        <span className="w-20 text-right font-medium text-wise-body">{formatCurrency(p.total_amount)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Order history */}
        <Card className="border-wise-border shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Order History</CardTitle>
            <span className="flex items-center gap-1 text-xs text-wise-mute">
              <Receipt className="h-3.5 w-3.5" /> {history.length} paid
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4"><SkeletonRows /></div>
            ) : history.length === 0 ? (
              <EmptyState icon={Receipt} text="No paid orders in this period." compact />
            ) : (
              <div className="max-h-[340px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-wise-border text-xs uppercase tracking-wider text-wise-mute">
                      <th className="px-4 py-2.5 text-left">Order</th>
                      <th className="px-4 py-2.5 text-left">When</th>
                      <th className="px-4 py-2.5 text-left">Customer</th>
                      <th className="px-4 py-2.5 text-center">Items</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((o) => (
                      <tr key={o.id} className="border-b border-wise-border transition-colors last:border-0 hover:bg-wise-canvas-soft">
                        <td className="px-4 py-2.5 font-medium text-wise-ink">
                          {o.order_number}
                          {o.table && <span className="ml-1.5 text-xs text-wise-mute">T{o.table.table_number}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-wise-body">{fmtTime(o.created_at)}</td>
                        <td className="px-4 py-2.5 text-wise-body">{o.customer?.name ?? "Walk-in"}</td>
                        <td className="px-4 py-2.5 text-center text-wise-body">{o.items.length}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-wise-ink">{formatCurrency(Number(o.total_amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Peak Hours + Day of Week ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-wise-mute" />
                Peak Hours (IST)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 pb-3">
              {loading ? (
                <div className="h-40 animate-pulse rounded-lg bg-wise-canvas-soft" />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7ddd2" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as { hour: string; orders: number; revenue: number };
                        return (
                          <div className="rounded-lg border border-wise-border bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="font-semibold text-wise-body">{d.hour}</p>
                            <p className="text-wise-ink-deep">{d.orders} orders · {formatCurrency(d.revenue)}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="orders" fill="#9fe870" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-wise-mute" />
                Day of Week
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 pb-3">
              {loading ? (
                <div className="h-40 animate-pulse rounded-lg bg-wise-canvas-soft" />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={dowData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d7ddd2" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as { day: string; orders: number; revenue: number };
                        return (
                          <div className="rounded-lg border border-wise-border bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="font-semibold text-wise-body">{d.day}</p>
                            <p className="text-wise-ink-deep">{formatCurrency(d.revenue)} · {d.orders} orders</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="revenue" fill="#163300" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Customer Insights ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-wise-mute" />
              Customer Insights
              {customerInsights.length > 0 && (
                <span className="ml-auto text-xs font-normal text-wise-mute">
                  {customerInsights.filter((c) => c.orders > 1).length} repeat · {customerInsights.filter((c) => c.orders === 1).length} new
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-wise-canvas-soft" />)}</div>
            ) : customerInsights.length === 0 ? (
              <p className="py-4 text-center text-sm text-wise-mute">No customer orders in this period</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wise-border">
                      {["Customer", "Email", "Orders", "Total Spent", "Avg Order", "Type", "Last Visit"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-wise-mute">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customerInsights.slice(0, 12).map((c, i) => (
                      <tr key={i} className="border-b border-wise-border last:border-0 hover:bg-wise-canvas-soft">
                        <td className="px-3 py-2.5 font-medium text-wise-ink">{c.name}</td>
                        <td className="px-3 py-2.5 text-wise-mute">{c.email || "—"}</td>
                        <td className="px-3 py-2.5 text-center text-wise-body">{c.orders}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-wise-ink">{formatCurrency(c.revenue)}</td>
                        <td className="px-3 py-2.5 text-right text-wise-body">{formatCurrency(c.revenue / c.orders)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-wisePill px-2 py-0.5 text-xs font-semibold ${ c.orders > 1 ? "bg-wise-primary-pale text-wise-positive-deep" : "bg-wise-canvas-soft text-wise-mute" }`}>
                            {c.orders > 1 ? "Repeat" : "New"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-wise-mute">{fmtTime(c.lastOrder)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Table Utilization + Coupon Impact ─────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-wise-mute" />
                Table Utilization
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {tableInsights.length === 0 ? (
                <p className="py-4 text-center text-sm text-wise-mute">No table orders in this period</p>
              ) : (
                <div className="space-y-2">
                  {tableInsights.map((t) => {
                    const bar = Math.max(4, t.share);
                    return (
                      <div key={t.table}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-wise-ink">Table {t.table}</span>
                          <span className="text-wise-mute">{t.orders} orders · {formatCurrency(t.revenue)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-wise-canvas-soft">
                          <div className="h-full rounded-full bg-wise-primary" style={{ width: `${bar}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-wise-mute" />
                Coupon Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {couponInsights.length === 0 ? (
                <p className="py-4 text-center text-sm text-wise-mute">No coupons used in this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-wise-border">
                        {["Code", "Type", "Uses", "Total Discount", "Avg/Use"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-wise-mute">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {couponInsights.map((c, i) => (
                        <tr key={i} className="border-b border-wise-border last:border-0 hover:bg-wise-canvas-soft">
                          <td className="px-3 py-2.5 font-mono font-semibold text-wise-ink">{c.code}</td>
                          <td className="px-3 py-2.5 text-wise-mute capitalize">{c.type}</td>
                          <td className="px-3 py-2.5 text-center text-wise-body">{c.timesUsed}</td>
                          <td className="px-3 py-2.5 font-semibold text-wise-negative">− {formatCurrency(c.totalDiscount)}</td>
                          <td className="px-3 py-2.5 text-wise-body">{formatCurrency(c.totalDiscount / c.timesUsed)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title, value, sub, icon: Icon, accent, tint, spark, loading, delay,
}: {
  title: string; value: string; sub?: string; icon: React.ElementType;
  accent: string; tint: string; spark?: number[]; loading: boolean; delay: number;
}): React.ReactElement {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-wise-border bg-gradient-to-br to-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
        tint,
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-wise-body">{title}</CardTitle>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}1a`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-wise-canvas-soft" />
        ) : (
          <p className="truncate font-display text-xl font-extrabold text-wise-ink">{value}</p>
        )}
        <div className="mt-1 flex items-end justify-between gap-2">
          {sub && <p className="text-xs text-wise-mute">{sub}</p>}
          {!loading && spark && spark.some((v) => v > 0) && (
            <Sparkline data={spark} color={accent} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }): React.ReactElement {
  const w = 64, h = 22, pad = 2;
  const max = Math.max(...data, 1);
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={color} />
    </svg>
  );
}

function RankBadge({ rank }: { rank: number }): React.ReactElement {
  const medal =
    rank === 1 ? "bg-amber-100 text-amber-700 ring-amber-200"
    : rank === 2 ? "bg-wise-canvas-soft text-wise-body ring-wise-border"
    : rank === 3 ? "bg-orange-100 text-orange-700 ring-orange-200"
    : "bg-wise-canvas-soft text-wise-mute ring-wise-border";
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1", medal)}>
      {rank}
    </span>
  );
}

function Avatar({ name }: { name: string }): React.ReactElement {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-xs font-bold text-white">
      {initials || "?"}
    </span>
  );
}

function EmptyState({ icon: Icon, text, compact }: { icon: React.ElementType; text: string; compact?: boolean }): React.ReactElement {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 text-center", compact ? "py-8" : "py-12")}>
      <Icon className="h-8 w-8 text-wise-mute" />
      <p className="text-sm text-wise-mute">{text}</p>
    </div>
  );
}

function SkeletonRows(): React.ReactElement {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-wise-canvas-soft" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/2 animate-pulse rounded bg-wise-canvas-soft" />
            <div className="h-1.5 w-full animate-pulse rounded bg-wise-canvas-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: { date: string; revenue: number; orders: number } }>;
}
function ChartTooltip({ active, payload }: TooltipPayload): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-wise-border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-wise-body">{d.date}</p>
      <p className="flex items-center justify-between gap-4 text-wise-ink-deep">
        <span>Revenue</span><span className="font-semibold">{formatCurrency(d.revenue)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 text-wise-body">
        <span>Orders</span><span className="font-semibold">{d.orders}</span>
      </p>
    </div>
  );
}

interface PayTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PaymentBreakdownRow }>;
}
function PayTooltip({ active, payload }: PayTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const meta = PAY_META[p.payment_method_type];
  return (
    <div className="rounded-lg border border-wise-border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-wise-body">{meta?.label ?? p.payment_method_type}</p>
      <p className="text-wise-body">{formatCurrency(p.total_amount)} · {p.order_count} orders</p>
    </div>
  );
}

interface CategoryTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TopCategoryRow }>;
}
function CategoryTooltip({ active, payload }: CategoryTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  return (
    <div className="rounded-lg border border-wise-border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-wise-ink">{c.category_name}</p>
      <p className="text-wise-body">{formatCurrency(c.revenue)} · {c.quantity_sold} sold</p>
    </div>
  );
}
