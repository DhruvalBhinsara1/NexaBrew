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

// ─── sub-components (inline to avoid over-engineering) ──────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
}): React.ReactElement {
  return (
    <Card className="border-surface-border bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-brand-400" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-zinc-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function TableOccupancyGrid({ floors }: { floors: FloorWithTables[] }): React.ReactElement {
  return (
    <div className="space-y-4">
      {floors.map((floor) => (
        <div key={floor.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {floor.name}
          </p>
          <div className="flex flex-wrap gap-2">
            {floor.tables
              .filter((t) => t.is_active)
              .map((table) => (
                <div
                  key={table.id}
                  title={`Table ${table.table_number} — ${table.status}`}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold",
                    table.status === "occupied"
                      ? "bg-brand-500 text-white"
                      : "bg-surface-muted text-zinc-400 border border-surface-border"
                  )}
                >
                  {table.table_number}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type RecentOrder = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  table_id: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent_to_kitchen: "bg-blue-100 text-blue-700",
  payment_pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

function RecentOrdersTable({ orders }: { orders: RecentOrder[] }): React.ReactElement {
  if (orders.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-400">No orders yet today.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs font-medium uppercase tracking-wider text-zinc-400">
            <th className="pb-2 pr-4 text-left">Order #</th>
            <th className="pb-2 pr-4 text-left">Status</th>
            <th className="pb-2 pr-4 text-left">Time</th>
            <th className="pb-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-surface-border last:border-0">
              <td className="py-3 pr-4 font-medium text-zinc-800">{o.order_number}</td>
              <td className="py-3 pr-4">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_BADGE[o.status] ?? "bg-zinc-100 text-zinc-600"
                  )}
                >
                  {o.status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="py-3 pr-4 text-zinc-500">{formatTime(o.created_at)}</td>
              <td className="py-3 text-right font-medium text-zinc-800">
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

  const [sessionResult, reportResult, floorsResult, ordersResult] = await Promise.allSettled([
    SessionService.getActive(supabase),
    ReportService.dailySummary(supabase, { from: today, to: today }),
    FloorService.listWithTables(supabase),
    supabase
      .from("orders")
      .select("id, order_number, status, total_amount, created_at, table_id")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const activeSession: SessionWithUser | null =
    sessionResult.status === "fulfilled" ? sessionResult.value : null;
  const todayRows: DailyRevenueRow[] =
    reportResult.status === "fulfilled" ? reportResult.value : [];
  const floors: FloorWithTables[] =
    floorsResult.status === "fulfilled" ? floorsResult.value : [];
  const recentOrders: RecentOrder[] =
    ordersResult.status === "fulfilled" ? ((ordersResult.value.data as RecentOrder[]) ?? []) : [];

  // Aggregated KPIs
  const todayOrderCount = todayRows.reduce((s, r) => s + r.order_count, 0);
  const todayRevenue = todayRows.reduce((s, r) => s + r.total_revenue, 0);
  const avgOrderValue = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;

  const allTables = floors.flatMap((f) => f.tables);
  const occupiedCount = allTables.filter((t) => t.status === "occupied").length;
  const totalTables = allTables.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
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
            className="flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            Manage sessions <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Orders Today"
          value={String(todayOrderCount)}
          sub="paid orders"
          icon={ShoppingCart}
        />
        <KpiCard
          title="Revenue Today"
          value={formatCurrency(todayRevenue)}
          sub="after discounts + tax"
          icon={TrendingUp}
        />
        <KpiCard
          title="Avg Order Value"
          value={todayOrderCount > 0 ? formatCurrency(avgOrderValue) : "—"}
          sub={todayOrderCount > 0 ? `over ${todayOrderCount} orders` : "no paid orders yet"}
          icon={BarChart3}
        />
        <KpiCard
          title="Tables Occupied"
          value={`${occupiedCount} / ${totalTables}`}
          sub={`${totalTables - occupiedCount} available`}
          icon={LayoutGrid}
        />
      </div>

      {/* Occupancy + Recent orders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Table occupancy */}
        <Card className="border-surface-border bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-zinc-800">
              Table Occupancy
            </CardTitle>
            <Link
              href="/dashboard/floors"
              className="text-xs text-brand-600 hover:underline"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {floors.length === 0 ? (
              <p className="text-sm text-zinc-400">No floors configured.</p>
            ) : (
              <TableOccupancyGrid floors={floors} />
            )}
            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-brand-500" />
                Occupied
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm border border-surface-border bg-surface-muted" />
                Available
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card className="border-surface-border bg-white shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-zinc-800">
              Recent Orders
            </CardTitle>
            <div className="flex items-center gap-3">
              <Link
                href="/pos/terminal"
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                POS Terminal <ArrowRight className="h-3 w-3" />
              </Link>
              <Link href="/kds" className="text-xs text-zinc-500 hover:underline">
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
            className="flex items-center gap-3 rounded-xl border border-surface-border bg-white p-4 shadow-sm hover:bg-surface-muted transition-colors"
          >
            <Icon className={cn("h-5 w-5", color)} />
            <span className="text-sm font-medium text-zinc-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
