import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  LayoutGrid,
  ShoppingCart,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { SessionService } from "@/services/SessionService";
import { ReportService } from "@/services/ReportService";
import { FloorService } from "@/services/FloorService";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TableOccupancyGrid } from "@/components/dashboard/TableOccupancyGrid";
import { TablesOccupiedCard } from "@/components/dashboard/TablesOccupiedCard";
import { KpiTrendCard, type TrendPoint } from "@/components/dashboard/KpiTrendCard";
import type { SessionWithUser, FloorWithTables } from "@/types/domain.types";
import type { DailyRevenueRow } from "@/services/ReportService";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Last `n` calendar dates ending today, as YYYY-MM-DD (oldest first). */
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(now - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

function shortDay(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2);
}

// ─── sub-components (inline to avoid over-engineering) ──────────────────────

type RecentOrder = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  table_id: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-wise-canvas-soft text-wise-body",
  sent_to_kitchen: "bg-blue-100 text-blue-700",
  payment_pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

/** Wide lime area-sparkline for the dark hero (server-rendered SVG). */
function HeroSparkline({ data }: { data: number[] }): React.ReactElement {
  const w = 560, h = 64, pad = 4;
  const max = Math.max(...data, 1);
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9fe870" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#9fe870" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#heroSpark)" />
      <path d={line} fill="none" stroke="#9fe870" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RecentOrdersTable({ orders }: { orders: RecentOrder[] }): React.ReactElement {
  if (orders.length === 0) {
    return <p className="py-8 text-center text-sm text-wise-mute">No orders yet today.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-wise-border text-xs font-medium uppercase tracking-wider text-wise-mute">
            <th className="pb-2 pr-4 text-left">Order #</th>
            <th className="pb-2 pr-4 text-left">Status</th>
            <th className="pb-2 pr-4 text-left">Time</th>
            <th className="pb-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-wise-border last:border-0">
              <td className="py-3 pr-4 font-medium text-wise-ink">{o.order_number}</td>
              <td className="py-3 pr-4">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_BADGE[o.status] ?? "bg-wise-canvas-soft text-wise-body"
                  )}
                >
                  {o.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="py-3 pr-4 text-wise-body">{formatTime(o.created_at)}</td>
              <td className="py-3 text-right font-medium text-wise-ink">
                {formatCurrency(Number(o.total_amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage(): Promise<React.ReactElement> {
  const supabase = createServerClient();
  const today = todayISO();
  const weekDates = lastNDates(7);
  const weekFrom = weekDates[0];

  const [sessionResult, reportResult, floorsResult, ordersResult, activeResult, weekResult] =
    await Promise.allSettled([
      SessionService.getActive(supabase),
      ReportService.dailySummary(supabase, { from: today, to: today }),
      FloorService.listWithTables(supabase),
      supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, table_id")
        .order("created_at", { ascending: false })
        .limit(10),
      // Tables with an active, UNPAID order — these can't be freed manually.
      supabase
        .from("orders")
        .select("order_number, status, table_id")
        .in("status", ["draft", "sent_to_kitchen", "payment_pending"])
        .not("table_id", "is", null),
      // 7-day daily summary for the KPI trend sparklines.
      ReportService.dailySummary(supabase, { from: weekFrom, to: today }),
    ]);

  const activeSession: SessionWithUser | null =
    sessionResult.status === "fulfilled" ? sessionResult.value : null;
  const todayRows: DailyRevenueRow[] =
    reportResult.status === "fulfilled" ? reportResult.value : [];
  const floors: FloorWithTables[] =
    floorsResult.status === "fulfilled" ? floorsResult.value : [];
  const recentOrders: RecentOrder[] =
    ordersResult.status === "fulfilled" ? ((ordersResult.value.data as RecentOrder[]) ?? []) : [];

  // Map of table_id → active unpaid order (blocks manual free in the grid).
  const activeRows =
    activeResult.status === "fulfilled"
      ? ((activeResult.value.data as { order_number: string; status: string; table_id: string }[]) ?? [])
      : [];
  const lockedTables = activeRows
    .filter((r) => r.table_id)
    .map((r) => ({ tableId: r.table_id, orderNumber: r.order_number, status: r.status }));

  // Aggregated KPIs
  const todayOrderCount = todayRows.reduce((s, r) => s + r.order_count, 0);
  const todayRevenue = todayRows.reduce((s, r) => s + r.total_revenue, 0);
  const avgOrderValue = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;

  const allTables = floors.flatMap((f) => f.tables);
  const occupiedCount = allTables.filter((t) => t.status === "occupied").length;
  const totalTables = allTables.length;

  // 7-day trend series for the KPI hover sparklines (fill missing days with 0).
  const weekRows: DailyRevenueRow[] =
    weekResult.status === "fulfilled" ? weekResult.value : [];
  const byDate = new Map(weekRows.map((r) => [r.date, r]));
  const ordersSeries: TrendPoint[] = weekDates.map((d) => ({
    label: shortDay(d),
    value: byDate.get(d)?.order_count ?? 0,
  }));
  const revenueSeries: TrendPoint[] = weekDates.map((d) => ({
    label: shortDay(d),
    value: byDate.get(d)?.total_revenue ?? 0,
  }));
  const aovSeries: TrendPoint[] = weekDates.map((d) => {
    const r = byDate.get(d);
    return {
      label: shortDay(d),
      value: r && r.order_count > 0 ? r.total_revenue / r.order_count : 0,
    };
  });

  return (
    <div className="space-y-5 p-6">
      {/* ── Hero: revenue statement (Wise polarity-flip — ink + lime) ── */}
      <section className="relative overflow-hidden rounded-wiseCard bg-wise-ink px-6 py-7 shadow-wiseCard sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-wise-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-wise-primary/5 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              <span className="h-1.5 w-1.5 rounded-full bg-wise-primary motion-safe:animate-pulse" />
              Revenue today ·{" "}
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
            <p className="mt-2 font-display text-5xl font-extrabold leading-none tracking-tight text-wise-primary sm:text-6xl">
              {formatCurrency(todayRevenue)}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-sm text-white/60">
              <span><span className="font-semibold text-white">{todayOrderCount}</span> paid orders</span>
              <span><span className="font-semibold text-white">{todayOrderCount > 0 ? formatCurrency(avgOrderValue) : "—"}</span> avg order</span>
              <span><span className="font-semibold text-white">{occupiedCount}/{totalTables}</span> tables seated</span>
            </div>
          </div>

          {/* Session status pill */}
          <div className="flex shrink-0 items-center gap-3 rounded-wisePill border border-white/15 bg-white/[0.06] px-4 py-2.5">
            <span className={cn("h-2 w-2 rounded-full", activeSession ? "bg-wise-primary motion-safe:animate-pulse" : "bg-wise-warning")} />
            <div className="text-sm leading-tight">
              {activeSession ? (
                <>
                  <span className="font-semibold text-white">Session open</span>
                  <span className="block text-xs text-white/50">since {formatTime(activeSession.opened_at)} · {activeSession.opened_by_user?.name ?? "—"}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-white">No active session</span>
                  <span className="block text-xs text-white/50">open one to take orders</span>
                </>
              )}
            </div>
            <Link
              href="/dashboard/sessions"
              className="ml-1 rounded-wisePill bg-wise-primary px-3 py-1.5 text-xs font-semibold text-wise-ink transition-colors hover:bg-wise-primary-active"
            >
              Manage
            </Link>
          </div>
        </div>

        {/* Week revenue sparkline strip */}
        <div className="relative mt-6 -mb-1 opacity-90">
          <HeroSparkline data={revenueSeries.map((p) => p.value)} />
          <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-white/30">
            {revenueSeries.map((p, i) => <span key={i}>{p.label}</span>)}
          </div>
        </div>
      </section>

      {/* ── Secondary KPIs (hover trend popovers) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTrendCard
          title="Orders Today" value={String(todayOrderCount)} sub="paid orders"
          icon="cart" href="/pos/orders" color="#2ead4b" chartType="bar"
          series={ordersSeries} format="int" popoverTitle="Orders trend"
        />
        <KpiTrendCard
          title="Avg Order Value" value={todayOrderCount > 0 ? formatCurrency(avgOrderValue) : "—"}
          sub={todayOrderCount > 0 ? `over ${todayOrderCount} orders` : "no paid orders yet"}
          icon="bar" href="/dashboard/reports" color="#7c3aed" chartType="area"
          series={aovSeries} format="currency" popoverTitle="Avg order value"
        />
        <TablesOccupiedCard
          occupiedCount={occupiedCount} totalTables={totalTables} floors={floors}
          lockedTableIds={lockedTables.map((l) => l.tableId)} href="/dashboard/floors"
        />
      </div>

      {/* ── Occupancy + Recent orders ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border-wise-border bg-white shadow-wiseCard">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-wise-ink">Table Occupancy</CardTitle>
            <Link href="/dashboard/floors" className="text-xs font-medium text-wise-ink-deep hover:underline">Manage</Link>
          </CardHeader>
          <CardContent>
            {floors.length === 0 ? (
              <p className="text-sm text-wise-mute">No floors configured.</p>
            ) : (
              <TableOccupancyGrid floors={floors} lockedTables={lockedTables} />
            )}
          </CardContent>
        </Card>

        <Card className="border-wise-border bg-white shadow-wiseCard lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-wise-ink">Recent Orders</CardTitle>
            <div className="flex items-center gap-3">
              <Link href="/pos/orders" className="flex items-center gap-1 text-xs font-medium text-wise-ink-deep hover:underline">
                All Orders &amp; Payments <ArrowRight className="h-3 w-3" />
              </Link>
              <Link href="/kds" className="text-xs text-wise-body hover:underline">Kitchen Display</Link>
            </div>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={recentOrders} />
          </CardContent>
        </Card>
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Reports", sub: "Sales & analytics", href: "/dashboard/reports", icon: BarChart3 },
          { label: "Products", sub: "Menu & pricing", href: "/dashboard/products", icon: CreditCard },
          { label: "Sessions", sub: "Cash drawer", href: "/dashboard/sessions", icon: ShoppingCart },
          { label: "Users", sub: "Staff accounts", href: "/dashboard/users", icon: LayoutGrid },
        ].map(({ label, sub, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-wiseCard border border-wise-border bg-white p-4 shadow-wiseCard transition-all duration-200 hover:-translate-y-0.5 hover:border-wise-primary"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-wise bg-wise-primary-pale text-wise-ink-deep transition-colors group-hover:bg-wise-primary group-hover:text-wise-ink">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-wise-ink">{label}</span>
              <span className="block truncate text-xs text-wise-mute">{sub}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-wise-mute transition-all group-hover:translate-x-0.5 group-hover:text-wise-ink-deep" />
          </Link>
        ))}
      </div>
    </div>
  );
}
