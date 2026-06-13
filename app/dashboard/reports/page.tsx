"use client";

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
  CreditCard,
  IndianRupee,
  Receipt,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type {
  DailyRevenueRow,
  EmployeeSalesRow,
  PaymentBreakdownRow,
  TopProductRow,
} from "@/services/ReportService";
import type { OrderWithItems } from "@/types/domain.types";

type Period = "today" | "week" | "month";

function rangeFor(period: Period): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const start = new Date(today);
  if (period === "week") start.setDate(today.getDate() - 6);
  if (period === "month") start.setDate(today.getDate() - 29);
  return { from: start.toISOString().slice(0, 10), to };
}

/** Continuous date list from..to (inclusive), YYYY-MM-DD. */
function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function compactCurrency(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function shortLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

const PAY_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  cash: { label: "Cash", color: "#16a34a", icon: Banknote },
  card: { label: "Card", color: "#2563eb", icon: CreditCard },
  upi: { label: "UPI", color: "#7c3aed", icon: Smartphone },
  razorpay: { label: "Razorpay", color: "#163300", icon: CreditCard },
};

export default function ReportsPage(): React.ReactElement {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("week");
  const [daily, setDaily] = useState<DailyRevenueRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeSalesRow[]>([]);
  const [payments, setPayments] = useState<PaymentBreakdownRow[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => rangeFor(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = `from=${range.from}&to=${range.to}`;
    try {
      const [d, tp, emp, pay, ord] = await Promise.all([
        apiGet<DailyRevenueRow[]>(`/api/reports/daily?${qs}`),
        apiGet<TopProductRow[]>(`/api/reports/top-products?${qs}&limit=10`),
        apiGet<EmployeeSalesRow[]>(`/api/reports/employees?${qs}`),
        apiGet<PaymentBreakdownRow[]>(`/api/reports/payments?${qs}`),
        apiGet<OrderWithItems[]>(`/api/orders`),
      ]);
      setDaily(d);
      setTopProducts(tp);
      setEmployees(emp);
      setPayments(pay);
      setOrders(ord);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
  const revenueSpark = chartData.map((c) => c.revenue);

  // Paid orders within the selected period → Order History.
  const history = orders
    .filter((o) => o.status === "paid")
    .filter((o) => {
      const d = o.created_at.slice(0, 10);
      return d >= range.from && d <= range.to;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const maxProductRev = Math.max(...topProducts.map((p) => p.revenue), 1);
  const maxEmpRev = Math.max(...employees.map((e) => e.total_revenue), 1);
  const payTotal = payments.reduce((s, p) => s + p.total_amount, 0);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Reports"
        subtitle={`${range.from} → ${range.to}`}
        action={
          <div className="flex rounded-lg border border-wise-border bg-white p-0.5 shadow-sm">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all duration-200",
                  period === p
                    ? "bg-wise-primary text-wise-ink shadow-sm"
                    : "text-wise-body hover:bg-wise-canvas-soft hover:text-wise-ink"
                )}
              >
                {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Orders" value={String(totalOrders)} sub={`in ${chartData.length} days`}
          icon={ShoppingCart} accent="#2ead4b" tint="from-wise-primary-pale" spark={ordersSpark} loading={loading} delay={0}
        />
        <StatCard
          title="Total Revenue" value={formatCurrency(totalRevenue)} sub="after discounts + tax"
          icon={IndianRupee} accent="#16a34a" tint="from-green-50" spark={revenueSpark} loading={loading} delay={60}
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
                <YAxis stroke="#868685" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compactCurrency} width={48} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#e8ebe6" }} />
                <Bar dataKey="orders" fill="#c5edab" radius={[3, 3, 0, 0]} barSize={18} />
                <Area
                  type="monotone" dataKey="revenue" stroke="#2ead4b" strokeWidth={2.5}
                  fill="url(#revFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
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
