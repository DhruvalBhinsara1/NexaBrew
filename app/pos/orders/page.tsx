"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Receipt, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { OrderStatus, OrderWithItems } from "@/types/domain.types";

const STATUSES: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent_to_kitchen", label: "Sent to Kitchen" },
  { value: "payment_pending", label: "Payment Pending" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

const BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent_to_kitchen: "bg-blue-100 text-blue-700",
  payment_pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export default function PosOrdersPage(): React.ReactElement {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setOrders(await apiGet<OrderWithItems[]>("/api/orders"));
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        const matchStatus = filter === "all" || o.status === filter;
        const matchSearch =
          !search ||
          o.order_number.toLowerCase().includes(search.toLowerCase()) ||
          (o.customer?.name ?? "").toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
      }),
    [orders, filter, search]
  );

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-surface-border bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/pos/terminal" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
            <ArrowLeft className="h-4 w-4" /> Terminal
          </Link>
          <span className="font-semibold text-zinc-800">Orders</span>
        </div>
        <Link href="/pos/customers" className="text-sm text-brand-600 hover:underline">Customers</Link>
      </header>

      <div className="space-y-4 p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input className="pl-9" placeholder="Search order # or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                filter === s.value ? "bg-brand-500 text-white" : "bg-white border border-surface-border text-zinc-600 hover:bg-surface-muted"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <Card className="border-surface-border">
          <CardContent className="p-0">
            {filtered.length === 0 && !loading ? (
              <EmptyState icon={Receipt} title="No orders" subtitle="Orders will appear here once created." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-zinc-400">
                      <th className="px-4 py-3 text-left">Order #</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-left">Table</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr key={o.id} className="border-b border-surface-border last:border-0">
                        <td className="px-4 py-3 font-medium text-zinc-800">{o.order_number}</td>
                        <td className="px-4 py-3 text-zinc-500">{o.customer?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-center text-zinc-500">{o.items.length}</td>
                        <td className="px-4 py-3 text-zinc-500">{o.table ? `T${o.table.table_number}` : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", BADGE[o.status] ?? "bg-zinc-100")}>
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{fmt(o.created_at)}</td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-800">{formatCurrency(Number(o.total_amount))}</td>
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
