import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  LayoutGrid,
  ShoppingCart,
  TrendingUp,
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-wise-ink">Dashboard</h1>
        <p className="text-sm text-wise-mute mt-0.5">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Session status banner */}
      <Card
        className={cn(
          "border-l-4 shadow-sm",
          activeSession
            ? "border-l-green-500 bg-green-50 border-green-200"
            : "border-l-amber-500 bg-amber-50 border-amber-200"
        )}
      >
        <CardContent className="flex items-center justify-between py-4">
          <div>
            {activeSession ? (
              <>
                <p className="font-semibold text-green-800">
                  Session open since {formatTime(activeSession.opened_at)}
                </p>
                <p className="text-sm text-green-700 mt-0.5">
                  Opened by {activeSession.opened_by_user?.name ?? "unknown"} ·{" "}
                  {formatDate(activeSession.opened_at)}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-amber-800">No active session</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Open a session to start taking orders.
                </p>
              </>
            )}
          </div>
          <Link
            href="/dashboard/sessions"
            className="flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-wise-body shadow-sm border border-wise-border hover:bg-wise-canvas-soft transition-colors"
          >
            Manage sessions <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTrendCard
          title="Orders Today"
          value={String(todayOrderCount)}
          sub="paid orders"
          icon="cart"
          href="/pos/orders"
          color="#2ead4b"
          chartType="bar"
          series={ordersSeries}
          format="int"
          popoverTitle="Orders trend"
        />
        <KpiTrendCard
          title="Revenue Today"
          value={formatCurrency(todayRevenue)}
          sub="after discounts + tax"
          icon="trending"
          href="/dashboard/reports"
          color="#16a34a"
          chartType="area"
          series={revenueSeries}
          format="currency"
          popoverTitle="Revenue trend"
        />
        <KpiTrendCard
          title="Avg Order Value"
          value={todayOrderCount > 0 ? formatCurrency(avgOrderValue) : "—"}
          sub={todayOrderCount > 0 ? `over ${todayOrderCount} orders` : "no paid orders yet"}
          icon="bar"
          href="/dashboard/reports"
          color="#7c3aed"
          chartType="area"
          series={aovSeries}
          format="currency"
          popoverTitle="Avg order value"
        />
        <TablesOccupiedCard
          occupiedCount={occupiedCount}
          totalTables={totalTables}
          floors={floors}
          lockedTableIds={lockedTables.map((l) => l.tableId)}
          href="/dashboard/floors"
        />
      </div>

      {/* Occupancy + Recent orders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Table occupancy */}
        <Card className="border-wise-border bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-wise-ink">
              Table Occupancy
            </CardTitle>
            <Link
              href="/dashboard/floors"
              className="text-xs text-wise-ink-deep hover:underline"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {floors.length === 0 ? (
              <p className="text-sm text-wise-mute">No floors configured.</p>
            ) : (
              <TableOccupancyGrid floors={floors} lockedTables={lockedTables} />
            )}
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card className="border-wise-border bg-white shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-wise-ink">
              Recent Orders
            </CardTitle>
            <div className="flex items-center gap-3">
              <Link
                href="/pos/orders"
                className="flex items-center gap-1 text-xs font-medium text-wise-ink-deep hover:underline"
              >
                All Orders &amp; Payments <ArrowRight className="h-3 w-3" />
              </Link>
              <Link href="/kds" className="text-xs text-wise-body hover:underline">
                Kitchen Display
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={recentOrders} />
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "View Reports", href: "/dashboard/reports", icon: BarChart3, color: "text-purple-600" },
          { label: "Manage Products", href: "/dashboard/products", icon: CreditCard, color: "text-blue-600" },
          { label: "View Sessions", href: "/dashboard/sessions", icon: ShoppingCart, color: "text-green-600" },
          { label: "Manage Users", href: "/dashboard/users", icon: LayoutGrid, color: "text-orange-600" },
        ].map(({ label, href, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-wise-border bg-white p-4 shadow-sm hover:bg-wise-canvas-soft transition-colors"
          >
            <Icon className={cn("h-5 w-5", color)} />
            <span className="text-sm font-medium text-wise-body">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
