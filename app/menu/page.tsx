"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, LogOut, Receipt, RefreshCw, UtensilsCrossed } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { Category, OrderWithItems, ProductWithCategory } from "@/types/domain.types";

const STATUS_STEPS = ["draft", "sent_to_kitchen", "payment_pending", "paid"] as const;
const STATUS_LABEL: Record<string, string> = {
  draft: "Order placed",
  sent_to_kitchen: "In the kitchen",
  payment_pending: "Ready — awaiting payment",
  paid: "Completed",
  cancelled: "Cancelled",
};
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent_to_kitchen: "bg-blue-100 text-blue-700",
  payment_pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function MenuPage(): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMenu = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        apiGet<ProductWithCategory[]>("/api/products"),
        apiGet<Category[]>("/api/categories"),
      ]);
      setProducts(p.filter((x) => x.is_active));
      setCategories(c);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }, [toast]);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await apiGet<OrderWithItems[]>("/api/orders/mine"));
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    void Promise.all([loadMenu(), loadOrders()]).finally(() => setLoading(false));
  }, [loadMenu, loadOrders]);

  const filtered = useMemo(
    () => (activeCat ? products.filter((p) => p.category_id === activeCat) : products),
    [products, activeCat]
  );

  async function logout(): Promise<void> {
    await createBrowserClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-surface-border bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-brand-600" />
          <span className="text-base font-bold text-brand-600">NexaBrew</span>
        </div>
        <button onClick={() => void logout()} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-border bg-white px-4">
        {([["menu", "Menu", UtensilsCrossed], ["orders", "My Orders", Receipt]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              tab === key ? "border-brand-500 text-brand-700" : "border-transparent text-zinc-500 hover:text-zinc-800"
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <main className="flex-1 p-4">
        {tab === "menu" ? (
          <>
            {/* Category filter */}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCat(null)}
                className={cn("rounded-full px-3 py-1.5 text-sm font-medium", activeCat === null ? "bg-brand-500 text-white" : "bg-white border border-surface-border text-zinc-600")}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium", activeCat === c.id ? "bg-brand-500 text-white" : "bg-white border border-surface-border text-zinc-600")}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? "#aaa" }} />
                  {c.name}
                </button>
              ))}
            </div>

            {filtered.length === 0 && !loading ? (
              <EmptyState icon={UtensilsCrossed} title="No items" subtitle="The menu is being prepared." />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => (
                  <Card key={p.id} className="overflow-hidden border-surface-border">
                    <div className="h-1.5 w-full" style={{ backgroundColor: p.category?.color ?? "#e2e8f0" }} />
                    <CardContent className="p-3">
                      <p className="font-semibold text-zinc-800">{p.name}</p>
                      {p.category && <p className="text-xs text-zinc-400">{p.category.name}</p>}
                      <p className="mt-2 text-lg font-bold text-brand-600">{formatCurrency(Number(p.price))}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <p className="mt-6 text-center text-xs text-zinc-400">
              Browse the menu and order with our staff. Track your order status under “My Orders”.
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-800">My Orders</h2>
              <Button size="sm" variant="outline" onClick={() => void loadOrders()}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
              </Button>
            </div>

            {orders.length === 0 && !loading ? (
              <EmptyState
                icon={Receipt}
                title="No orders yet"
                subtitle="When our staff place an order under your name, it'll show here with live status."
              />
            ) : (
              <div className="space-y-3">
                {orders.map((o) => {
                  const stepIdx = STATUS_STEPS.indexOf(o.status as (typeof STATUS_STEPS)[number]);
                  return (
                    <Card key={o.id} className="border-surface-border">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-zinc-800">Order {o.order_number}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[o.status])}>
                            {STATUS_LABEL[o.status] ?? o.status}
                          </span>
                        </div>

                        {/* Progress bar (skip for cancelled) */}
                        {o.status !== "cancelled" && (
                          <div className="mt-3 flex gap-1">
                            {STATUS_STEPS.map((s, i) => (
                              <div key={s} className={cn("h-1.5 flex-1 rounded-full", i <= stepIdx ? "bg-brand-500" : "bg-surface-border")} />
                            ))}
                          </div>
                        )}

                        <ul className="mt-3 space-y-1 text-sm text-zinc-600">
                          {o.items.map((it) => (
                            <li key={it.id} className="flex justify-between">
                              <span>{it.product_name} × {it.quantity}</span>
                              <span>{formatCurrency(Number(it.line_total))}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex justify-between border-t border-surface-border pt-2 text-sm font-semibold text-zinc-800">
                          <span>Total</span>
                          <span>{formatCurrency(Number(o.total_amount))}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
