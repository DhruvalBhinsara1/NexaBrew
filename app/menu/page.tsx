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

// Order with the kitchen ticket status joined in (see OrderService.listForCustomerUser)
type CustomerOrder = OrderWithItems & { kitchen_tickets?: { status: string }[] };

// Granular stages: the order status can't distinguish "queued to cook" from
// "preparing" (both are sent_to_kitchen), so we fold in the kitchen ticket.
type Stage = "placed" | "queued" | "preparing" | "ready" | "paid" | "cancelled";
const STAGE_STEPS: Stage[] = ["placed", "queued", "preparing", "ready", "paid"];
const STAGE_LABEL: Record<Stage, string> = {
  placed: "Order placed",
  queued: "In the kitchen",
  preparing: "Preparing",
  ready: "Ready — awaiting payment",
  paid: "Completed",
  cancelled: "Cancelled",
};
const STAGE_BADGE: Record<Stage, string> = {
  placed: "bg-wise-canvas-soft text-wise-body",
  queued: "bg-blue-100 text-blue-700",
  preparing: "bg-indigo-100 text-indigo-700",
  ready: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

function stageOf(order: CustomerOrder): Stage {
  switch (order.status) {
    case "cancelled":
      return "cancelled";
    case "paid":
      return "paid";
    case "payment_pending":
      return "ready";
    case "draft":
      return "placed";
    case "sent_to_kitchen": {
      const ticket = order.kitchen_tickets?.[0]?.status;
      return ticket === "preparing" || ticket === "completed" ? "preparing" : "queued";
    }
    default:
      return "placed";
  }
}

export default function MenuPage(): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
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
      setOrders(await apiGet<CustomerOrder[]>("/api/orders/mine"));
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    void Promise.all([loadMenu(), loadOrders()]).finally(() => setLoading(false));
  }, [loadMenu, loadOrders]);

  // Live updates: refetch my orders whenever any order changes (cheap; the API
  // scopes to this customer). Gives the "is it being prepared?" status live.
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("menu:my-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadOrders())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadOrders]);

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
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-wise-border bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-wise-primary to-wise-primary text-white">
            <Coffee className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-wise-ink">NexaBrew</span>
            <span className="block text-[11px] text-wise-mute">Menu &amp; Orders</span>
          </div>
        </div>
        <button onClick={() => void logout()} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-wise-body transition-colors hover:bg-wise-canvas-soft hover:text-wise-ink">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-wise-border bg-white px-4">
        {([["menu", "Menu", UtensilsCrossed], ["orders", "My Orders", Receipt]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              tab === key ? "border-wise-primary text-wise-ink-deep" : "border-transparent text-wise-body hover:text-wise-ink"
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
                className={cn("rounded-full px-3 py-1.5 text-sm font-medium", activeCat === null ? "bg-wise-primary text-wise-ink" : "bg-white border border-wise-border text-wise-body")}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium", activeCat === c.id ? "bg-wise-primary text-wise-ink" : "bg-white border border-wise-border text-wise-body")}
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
                  <Card key={p.id} className="overflow-hidden border-wise-border">
                    <div className="h-1.5 w-full" style={{ backgroundColor: p.category?.color ?? "#e2e8f0" }} />
                    <CardContent className="p-3">
                      <p className="font-semibold text-wise-ink">{p.name}</p>
                      {p.category && <p className="text-xs text-wise-mute">{p.category.name}</p>}
                      <p className="mt-2 text-lg font-bold text-wise-ink-deep">{formatCurrency(Number(p.price))}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <p className="mt-6 text-center text-xs text-wise-mute">
              Browse the menu and order with our staff. Track your order status under “My Orders”.
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-wise-ink">My Orders</h2>
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
                  const stage = stageOf(o);
                  const stepIdx = STAGE_STEPS.indexOf(stage);
                  return (
                    <Card key={o.id} className="border-wise-border">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-wise-ink">Order {o.order_number}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STAGE_BADGE[stage])}>
                            {STAGE_LABEL[stage]}
                          </span>
                        </div>

                        {/* Progress bar (skip for cancelled) */}
                        {stage !== "cancelled" && (
                          <div className="mt-3 flex gap-1">
                            {STAGE_STEPS.map((s, i) => (
                              <div key={s} className={cn("h-1.5 flex-1 rounded-full", i <= stepIdx ? "bg-wise-primary" : "bg-wise-canvas-border")} />
                            ))}
                          </div>
                        )}

                        <ul className="mt-3 space-y-1 text-sm text-wise-body">
                          {o.items.map((it) => (
                            <li key={it.id} className="flex justify-between">
                              <span>{it.product_name} × {it.quantity}</span>
                              <span>{formatCurrency(Number(it.line_total))}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex justify-between border-t border-wise-border pt-2 text-sm font-semibold text-wise-ink">
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
