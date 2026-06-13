"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, LogOut, Minus, Plus, Receipt, RefreshCw, ShoppingBag, Trash2, UtensilsCrossed, X } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlideTextButton } from "@/components/kokonutui";
import { PaymentDialog } from "@/components/pos/PaymentDialog";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { Category, FloorWithTables, OrderWithItems, ProductWithCategory } from "@/types/domain.types";

type CustomerOrder = OrderWithItems & { kitchen_tickets?: { status: string }[] };

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
    case "cancelled": return "cancelled";
    case "paid": return "paid";
    case "payment_pending": return "ready";
    case "draft": return "placed";
    case "sent_to_kitchen": {
      const ticket = order.kitchen_tickets?.[0]?.status;
      return ticket === "preparing" || ticket === "completed" ? "preparing" : "queued";
    }
    default: return "placed";
  }
}

interface CartLine {
  product: ProductWithCategory;
  qty: number;
}

const CART_STORAGE_KEY = (uid: string) => `nexabrew:cart:${uid}`;

export default function MenuPage(): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [floors, setFloors] = useState<FloorWithTables[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Cart + checkout
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [tableId, setTableId] = useState<string>("");
  const [coupon, setCoupon] = useState("");
  const [placing, setPlacing] = useState(false);
  const [payOrder, setPayOrder] = useState<{ id: string; number: string; total: number } | null>(null);
  // Tracks a draft online order that was created but not yet paid.
  // Cancelling it before re-placing avoids duplicate orders when the user
  // edits the cart after closing the PaymentDialog.
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const showToast = (title: string, variant?: "default" | "destructive") => toast({ title, variant });

  const loadMenu = useCallback(async () => {
    try {
      const [p, c, f] = await Promise.all([
        apiGet<ProductWithCategory[]>("/api/products"),
        apiGet<Category[]>("/api/categories"),
        apiGet<FloorWithTables[]>("/api/floors"),
      ]);
      setProducts(p.filter((x) => x.is_active));
      setCategories(c);
      setFloors(f);
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

  // Resolve user ID and restore saved cart from localStorage
  useEffect(() => {
    const supabase = createBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        try {
          const saved = localStorage.getItem(CART_STORAGE_KEY(uid));
          if (saved) {
            const parsed = JSON.parse(saved) as Record<string, CartLine>;
            // Only restore if products haven't loaded yet (avoids stale refs)
            setCart(parsed);
          }
        } catch {
          // ignore malformed storage
        }
      }
    });
  }, []);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (!userId) return;
    try {
      if (Object.keys(cart).length === 0) {
        localStorage.removeItem(CART_STORAGE_KEY(userId));
      } else {
        localStorage.setItem(CART_STORAGE_KEY(userId), JSON.stringify(cart));
      }
    } catch {
      // quota exceeded or private browsing — fail silently
    }
  }, [cart, userId]);

  useEffect(() => {
    void Promise.all([loadMenu(), loadOrders()]).finally(() => setLoading(false));
  }, [loadMenu, loadOrders]);

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("menu:my-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadOrders())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadOrders]);

  const filtered = useMemo(
    () => (activeCat ? products.filter((p) => p.category_id === activeCat) : products),
    [products, activeCat]
  );

  // ── Cart helpers ──
  const cartLines = useMemo(() => Object.values(cart), [cart]);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartSubtotal = cartLines.reduce((s, l) => s + Number(l.product.price) * l.qty, 0);

  function addToCart(product: ProductWithCategory): void {
    setCart((c) => ({ ...c, [product.id]: { product, qty: (c[product.id]?.qty ?? 0) + 1 } }));
  }
  function setQty(id: string, qty: number): void {
    setCart((c) => {
      if (qty <= 0) {
        const next = { ...c };
        delete next[id];
        return next;
      }
      return { ...c, [id]: { ...c[id], qty } };
    });
  }

  const availableTables = floors.flatMap((f) =>
    f.tables.filter((t) => t.is_active && t.status !== "occupied").map((t) => ({ ...t, floor: f.name }))
  );

  async function placeOrder(mode: "counter" | "online"): Promise<void> {
    if (cartLines.length === 0) return;
    setPlacing(true);
    try {
      // If an unpaid online order already exists, cancel it first so we don't
      // accumulate duplicate draft orders when the user edits and re-submits.
      if (mode === "online" && pendingOrderId) {
        await fetch(`/api/orders/${pendingOrderId}/cancel`, { method: "POST" });
        setPendingOrderId(null);
      }

      const res = await fetch("/api/orders/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartLines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
          table_id: tableId || undefined,
          coupon_code: coupon.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not place your order.", "destructive");
        return;
      }
      const order = data.data as OrderWithItems;

      if (mode === "counter") {
        // Counter: payment is handled at the desk — clear cart immediately.
        setCart({});
        if (userId) localStorage.removeItem(CART_STORAGE_KEY(userId));
        setCoupon("");
        setTableId("");
        setCartOpen(false);
        showToast("Order placed — it's roasting to perfection! ☕");
        setTab("orders");
        void loadOrders();
      } else {
        // Online: keep cart alive until payment is confirmed.
        // Store the order ID so the next attempt can cancel this one first.
        setPendingOrderId(order.id);
        setCoupon("");
        setTableId("");
        setCartOpen(false);
        setPayOrder({ id: order.id, number: order.order_number, total: Number(order.total_amount) });
      }
    } catch {
      showToast("Something brewed wrong. Please try again.", "destructive");
    } finally {
      setPlacing(false);
    }
  }

  async function logout(): Promise<void> {
    await createBrowserClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-wise-border bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-wise bg-wise-primary text-wise-ink">
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
      <div className="sticky top-[57px] z-10 flex gap-2 border-b border-wise-border bg-white px-4">
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
            {/* Hero */}
            <section className="mb-5 overflow-hidden rounded-wiseCard bg-wise-primary-pale px-5 py-6 sm:px-7 sm:py-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wise-ink-deep/70">NexaBrew Cafe</p>
              <h1 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-wise-ink sm:text-4xl">
                What can we get you?
              </h1>
              <p className="mt-2 max-w-md text-sm text-wise-body">
                Tap to add, then place your order — pay online or at the counter. Espresso yourself!
              </p>
            </section>

            {/* Category filter */}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCat(null)}
                className={cn("rounded-full px-3 py-1.5 text-sm font-medium transition-colors", activeCat === null ? "bg-wise-primary text-wise-ink" : "bg-white border border-wise-border text-wise-body hover:border-wise-primary")}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors", activeCat === c.id ? "bg-wise-primary text-wise-ink" : "bg-white border border-wise-border text-wise-body hover:border-wise-primary")}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? "#9fe870" }} />
                  {c.name}
                </button>
              ))}
            </div>

            {filtered.length === 0 && !loading ? (
              <EmptyState icon={UtensilsCrossed} title="Bean there, brewed that" subtitle="The menu is still warming up — check back soon." />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => {
                  const color = p.category?.color ?? "#9fe870";
                  const qty = cart[p.id]?.qty ?? 0;
                  return (
                    <Card
                      key={p.id}
                      className="group overflow-hidden border-wise-border transition-all duration-200 hover:-translate-y-1 hover:shadow-wiseCard"
                    >
                      <button onClick={() => addToCart(p)} className="block w-full text-left">
                        <div
                          className="relative flex h-24 items-end justify-end overflow-hidden p-2"
                          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                        >
                          <span className="absolute left-3 top-3 font-display text-2xl font-extrabold text-white/90">
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                          {qty > 0 && (
                            <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-wise-ink px-1.5 text-xs font-bold text-wise-primary">
                              {qty}
                            </span>
                          )}
                          <UtensilsCrossed className="h-7 w-7 text-white/30 transition-transform duration-300 group-hover:scale-110" />
                        </div>
                        <div className="p-3.5">
                          <p className="font-semibold leading-snug text-wise-ink">{p.name}</p>
                          {p.category && <p className="text-xs text-wise-mute">{p.category.name}</p>}
                          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-wisePill bg-wise-primary-pale px-2.5 py-0.5 text-sm font-bold text-wise-ink-deep">
                            {formatCurrency(Number(p.price))}
                            <Plus className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </button>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-wise-ink">My Orders</h2>
              <Button size="sm" variant="outline" onClick={() => void loadOrders()}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
              </Button>
            </div>

            {orders.length === 0 && !loading ? (
              <EmptyState
                icon={Receipt}
                title="No orders yet"
                subtitle="Life happens, coffee helps — place your first order from the Menu tab."
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

                        {stage !== "cancelled" && (
                          <div className="mt-3 flex gap-1">
                            {STAGE_STEPS.map((s, i) => (
                              <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= stepIdx ? "bg-wise-primary" : "bg-wise-border")} />
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

      {/* Floating cart bar */}
      {cartCount > 0 && tab === "menu" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-wise-border bg-white/95 px-4 py-3 backdrop-blur motion-safe:animate-in motion-safe:slide-in-from-bottom-4">
          <button
            onClick={() => setCartOpen(true)}
            className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-wiseCard bg-wise-ink px-5 py-3 text-white transition-colors hover:bg-wise-ink/90"
          >
            <span className="flex items-center gap-2.5">
              <span className="relative">
                <ShoppingBag className="h-5 w-5 text-wise-primary" />
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-wise-primary px-1 text-[10px] font-bold text-wise-ink">{cartCount}</span>
              </span>
              <span className="text-sm font-semibold">Review order</span>
            </span>
            <span className="font-display text-lg font-extrabold text-wise-primary">{formatCurrency(cartSubtotal)}</span>
          </button>
        </div>
      )}

      {/* Cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button aria-label="Close cart" className="absolute inset-0 bg-wise-ink/40 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in" onClick={() => setCartOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col bg-wise-canvas shadow-wiseModal motion-safe:animate-in motion-safe:slide-in-from-right">
            <div className="flex items-center justify-between border-b border-wise-border px-5 py-4">
              <h2 className="font-display text-lg font-extrabold text-wise-ink">Your order</h2>
              <button onClick={() => setCartOpen(false)} className="rounded-full p-1.5 text-wise-mute hover:bg-wise-canvas-soft hover:text-wise-ink"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {cartLines.map((l) => (
                <div key={l.product.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-wise-ink">{l.product.name}</p>
                    <p className="text-xs text-wise-mute">{formatCurrency(Number(l.product.price))} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setQty(l.product.id, l.qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-wise-border text-wise-body hover:bg-wise-canvas-soft"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-5 text-center text-sm font-semibold text-wise-ink">{l.qty}</span>
                    <button onClick={() => setQty(l.product.id, l.qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-wise-border text-wise-body hover:bg-wise-canvas-soft"><Plus className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setQty(l.product.id, 0)} className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}

              {/* Table picker */}
              <div className="pt-2">
                <label className="text-xs font-medium text-wise-ink">Where are you sitting?</label>
                <select
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="mt-1.5 block w-full rounded-wise border border-wise-border bg-white px-3 py-2.5 text-sm text-wise-ink focus:border-wise-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="">Pickup at counter</option>
                  {floors.map((f) => {
                    const ts = f.tables.filter((t) => t.is_active && t.status !== "occupied");
                    if (ts.length === 0) return null;
                    return (
                      <optgroup key={f.id} label={f.name}>
                        {ts.map((t) => (
                          <option key={t.id} value={t.id}>Table {t.table_number} · {t.seats} seats</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {availableTables.length === 0 && (
                  <p className="mt-1 text-xs text-wise-mute">No free tables right now — pickup it is!</p>
                )}
              </div>

              {/* Coupon */}
              <div>
                <label className="text-xs font-medium text-wise-ink">Coupon code (optional)</label>
                <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" className="mt-1.5" />
              </div>
            </div>

            {/* Footer / checkout */}
            <div className="border-t border-wise-border px-5 py-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm text-wise-body">Subtotal{coupon.trim() ? " (before coupon)" : ""}</span>
                <span className="font-display text-xl font-extrabold text-wise-ink">{formatCurrency(cartSubtotal)}</span>
              </div>
              <p className="mb-3 text-xs text-wise-mute">Taxes &amp; any coupon are applied on the final bill.</p>
              <div className="space-y-2">
                <SlideTextButton onClick={() => void placeOrder("online")} loading={placing}>
                  Place &amp; pay online
                </SlideTextButton>
                <Button variant="outline" className="w-full" disabled={placing} onClick={() => void placeOrder("counter")}>
                  Place order · pay at counter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Online payment */}
      {payOrder && (
        <PaymentDialog
          orderId={payOrder.id}
          orderNumber={payOrder.number}
          total={payOrder.total}
          open={!!payOrder}
          onClose={() => {
            // Immediately cancel the unpaid draft order so it doesn't linger
            // as a stale entry in My Orders. Cart stays intact for editing.
            if (pendingOrderId) {
              void fetch(`/api/orders/${pendingOrderId}/cancel`, { method: "POST" });
              setPendingOrderId(null);
            }
            setPayOrder(null);
            setCartOpen(true);
            showToast("Order cancelled — edit your cart and try again.");
          }}
          onlineOnly
          onPaid={() => {
            // Payment confirmed — clear the pending order + cart.
            setPayOrder(null);
            setPendingOrderId(null);
            setCart({});
            if (userId) localStorage.removeItem(CART_STORAGE_KEY(userId));
            setTab("orders");
            void loadOrders();
          }}
          toast={(msg, variant) => toast({ title: msg, variant: variant === "error" ? "destructive" : "default" })}
        />
      )}
    </div>
  );
}
