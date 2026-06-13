"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Receipt, Search, Trash2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/ui/pagination";
import { PaymentDialog } from "@/components/pos/PaymentDialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
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
  const [selected, setSelected] = useState<OrderWithItems | null>(null);
  const [payingOrder, setPayingOrder] = useState<OrderWithItems | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await apiGet<OrderWithItems[]>("/api/orders"));
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  async function cancelOrder(o: OrderWithItems): Promise<void> {
    if (!confirm(`Cancel order ${o.order_number}?`)) return;
    setBusy(true);
    try {
      await apiSend(`/api/orders/${o.id}/cancel`, "POST");
      toast({ title: "Order cancelled" });
      setSelected(null);
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteOrder(o: OrderWithItems): Promise<void> {
    if (!confirm(`Delete draft order ${o.order_number}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiSend(`/api/orders/${o.id}`, "DELETE");
      toast({ title: "Order deleted" });
      setSelected(null);
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

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

  // Client-side pagination over the filtered list.
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filter, search, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

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
                    {paged.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => setSelected(o)}
                        className="cursor-pointer border-b border-surface-border last:border-0 hover:bg-surface-muted"
                      >
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

        <Pagination
          page={page}
          totalPages={totalPages}
          hasNextPage={page < totalPages}
          hasPreviousPage={page > 1}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* Order detail sheet */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Order {selected.order_number}
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", BADGE[selected.status] ?? "bg-zinc-100")}>
                    {selected.status.replace(/_/g, " ")}
                  </span>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-1 text-sm text-zinc-500">
                <p>Table: {selected.table ? `T${selected.table.table_number}` : "—"}</p>
                <p>Customer: {selected.customer?.name ?? "Walk-in"}</p>
                <p>Created: {fmt(selected.created_at)}</p>
              </div>

              <Separator className="my-4" />

              <ul className="space-y-2">
                {selected.items.map((it) => (
                  <li key={it.id} className="flex justify-between text-sm">
                    <span className="text-zinc-700">{it.product_name} × {it.quantity}</span>
                    <span className="font-medium text-zinc-800">{formatCurrency(Number(it.line_total))}</span>
                  </li>
                ))}
              </ul>

              <Separator className="my-4" />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-zinc-500"><span>Subtotal</span><span>{formatCurrency(Number(selected.subtotal))}</span></div>
                <div className="flex justify-between text-zinc-500"><span>Discount</span><span>−{formatCurrency(Number(selected.discount_amount))}</span></div>
                <div className="flex justify-between text-zinc-500"><span>Tax</span><span>{formatCurrency(Number(selected.tax_amount))}</span></div>
                <div className="flex justify-between text-base font-bold text-zinc-900"><span>Total</span><span>{formatCurrency(Number(selected.total_amount))}</span></div>
              </div>

              {selected.status === "payment_pending" && (
                <SheetFooter className="mt-6">
                  <Button
                    className="w-full bg-brand-500 hover:bg-brand-600"
                    onClick={() => setPayingOrder(selected)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" /> Process Payment
                  </Button>
                </SheetFooter>
              )}

              {(selected.status === "draft" || selected.status === "sent_to_kitchen") && (
                <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
                  {selected.status === "draft" && (
                    <Button variant="outline" className="w-full" onClick={() => void deleteOrder(selected)} disabled={busy}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Draft
                    </Button>
                  )}
                  <Button variant="destructive" className="w-full" onClick={() => void cancelOrder(selected)} disabled={busy}>
                    <XCircle className="mr-2 h-4 w-4" /> Cancel Order
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Process Payment */}
      {payingOrder && (
        <PaymentDialog
          orderId={payingOrder.id}
          orderNumber={payingOrder.order_number}
          total={Number(payingOrder.total_amount)}
          customerName={payingOrder.customer?.name}
          open={!!payingOrder}
          onClose={() => setPayingOrder(null)}
          onPaid={() => {
            setSelected(null);
            void load();
          }}
          toast={(msg, variant) =>
            toast({ title: msg, variant: variant === "error" ? "destructive" : "default" })
          }
        />
      )}
    </div>
  );
}
