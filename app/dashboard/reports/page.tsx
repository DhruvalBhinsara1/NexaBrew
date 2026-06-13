"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, IndianRupee, ShoppingCart, TrendingUp } from "lucide-react";
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

type Period = "today" | "week" | "month";

function rangeFor(period: Period): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const start = new Date(today);
  if (period === "week") start.setDate(today.getDate() - 6);
  if (period === "month") start.setDate(today.getDate() - 29);
  return { from: start.toISOString().slice(0, 10), to };
}

export default function ReportsPage(): React.ReactElement {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("week");
  const [daily, setDaily] = useState<DailyRevenueRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeSalesRow[]>([]);
  const [payments, setPayments] = useState<PaymentBreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => rangeFor(period), [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = `from=${range.from}&to=${range.to}`;
    try {
      const [d, tp, emp, pay] = await Promise.all([
        apiGet<DailyRevenueRow[]>(`/api/reports/daily?${qs}`),
        apiGet<TopProductRow[]>(`/api/reports/top-products?${qs}&limit=10`),
        apiGet<EmployeeSalesRow[]>(`/api/reports/employees?${qs}`),
        apiGet<PaymentBreakdownRow[]>(`/api/reports/payments?${qs}`),
      ]);
      setDaily(d);
      setTopProducts(tp);
      setEmployees(emp);
      setPayments(pay);
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

  const chartData = daily.map((r) => ({
    date: r.date.slice(5),
    revenue: r.total_revenue,
  }));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Reports"
        subtitle={`${range.from} → ${range.to}`}
        action={
          <div className="flex rounded-lg border border-surface-border bg-white p-0.5">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  period === p ? "bg-brand-500 text-white" : "text-zinc-500 hover:text-zinc-800"
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
        <StatCard title="Total Orders" value={String(totalOrders)} icon={ShoppingCart} />
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={IndianRupee} />
        <StatCard title="Avg Order Value" value={totalOrders ? formatCurrency(avgOrder) : "—"} icon={TrendingUp} />
        <StatCard
          title="Top Product"
          value={topProduct?.product_name ?? "—"}
          sub={topProduct ? `${topProduct.quantity_sold} sold` : undefined}
          icon={BarChart3}
        />
      </div>

      {/* Revenue chart */}
      <Card className="border-surface-border">
        <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-12 text-center text-sm text-zinc-400">Loading…</p>
          ) : chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-400">No paid orders in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="#d4791f" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tables row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-surface-border">
          <CardHeader><CardTitle className="text-base">Top Products</CardTitle></CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              cols={["Product", "Qty", "Revenue"]}
              rows={topProducts.map((p) => [p.product_name, String(p.quantity_sold), formatCurrency(p.revenue)])}
              empty="No sales yet."
            />
          </CardContent>
        </Card>

        <Card className="border-surface-border">
          <CardHeader><CardTitle className="text-base">Sales by Employee</CardTitle></CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              cols={["Employee", "Orders", "Revenue"]}
              rows={employees.map((e) => [e.employee_name, String(e.order_count), formatCurrency(e.total_revenue)])}
              empty="No sales yet."
            />
          </CardContent>
        </Card>
      </div>

      {/* Payment breakdown */}
      <Card className="border-surface-border">
        <CardHeader><CardTitle className="text-base">Payment Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <SimpleTable
            cols={["Method", "Orders", "Total"]}
            rows={payments.map((p) => [p.payment_method_type.toUpperCase(), String(p.order_count), formatCurrency(p.total_amount)])}
            empty="No payments yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
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
    <Card className="border-surface-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-brand-400" />
      </CardHeader>
      <CardContent>
        <p className="truncate text-xl font-bold text-zinc-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SimpleTable({
  cols,
  rows,
  empty,
}: {
  cols: string[];
  rows: string[][];
  empty: string;
}): React.ReactElement {
  if (rows.length === 0) {
    return <p className="px-4 pb-4 text-sm text-zinc-400">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-zinc-400">
            {cols.map((c, i) => (
              <th key={c} className={cn("px-4 py-2", i === 0 ? "text-left" : "text-right")}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-surface-border last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className={cn("px-4 py-2", ci === 0 ? "text-left font-medium text-zinc-800" : "text-right text-zinc-600")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
