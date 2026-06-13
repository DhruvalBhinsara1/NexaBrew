"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChefHat, Coffee, LogOut, LayoutGrid, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { usePosStore } from "@/store/usePosStore";
import { ProductsPanel } from "@/components/pos/ProductsPanel";
import { CartPanel } from "@/components/pos/CartPanel";
import { PaymentPanel } from "@/components/pos/PaymentPanel";
import { TableSelectorDialog } from "@/components/pos/TableSelectorDialog";
import { CouponDialog } from "@/components/pos/CouponDialog";
import { CustomerDialog } from "@/components/pos/CustomerDialog";
import { OpenBillsSheet, fetchOpenBillCount } from "@/components/pos/OpenBillsSheet";
import { useToast } from "@/hooks/use-toast";
import type { Category, FloorWithTables, ProductWithCategory, Table } from "@/types/domain.types";

interface SessionData {
  id: string;
  status: string;
}

export function PosTerminal(): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();

  // Data
  const [session, setSession] = useState<SessionData | null>(null);
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [floors, setFloors] = useState<FloorWithTables[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // UI state
  const [tableSelectorOpen, setTableSelectorOpen] = useState(false);
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [openBillsOpen, setOpenBillsOpen] = useState(false);
  const [openBillCount, setOpenBillCount] = useState(0);
  const [billsRefreshKey, setBillsRefreshKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);

  // Store
  const {
    setSession: setStoreSession,
    tableId, tableNumber, setTable,
    cartItems, couponCode, clearCart,
    customerId,
    orderId,
    setOrder, updateStatus, bumpOrder,
    startNewBill,
  } = usePosStore();

  // Load initial data
  useEffect(() => {
    async function loadData(): Promise<void> {
      setLoading(true);
      try {
        const [sessRes, prodRes, catRes, floorRes] = await Promise.all([
          fetch("/api/sessions"),
          fetch("/api/products?is_active=true"),
          fetch("/api/categories"),
          fetch("/api/floors"),
        ]);

        const sessData = await sessRes.json();
        const openSession = (sessData.data as SessionData[] | undefined)?.find(
          (s) => s.status === "open"
        );
        if (openSession) {
          setSession(openSession);
          setStoreSession(openSession.id);
        } else {
          setSessionError("No active session. Open one to start taking orders.");
        }

        const prodData = await prodRes.json();
        setProducts((prodData.data as ProductWithCategory[] | undefined) ?? []);

        const catData = await catRes.json();
        setCategories((catData.data as Category[] | undefined) ?? []);

        const floorData = await floorRes.json();
        setFloors((floorData.data as FloorWithTables[] | undefined) ?? []);
      } catch {
        setSessionError("Failed to load POS data. Please refresh.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [setStoreSession]);

  // Realtime: watch for order status changes (payment_pending after kitchen completes)
  const supabase = useMemo(() => createBrowserClient(), []);

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`pos-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const newStatus = (payload.new as Record<string, unknown>).status as string;
          updateStatus(newStatus);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, supabase, updateStatus]);

  const refreshOpenBillCount = useCallback(async () => {
    if (!session?.id) {
      setOpenBillCount(0);
      return;
    }
    try {
      setOpenBillCount(await fetchOpenBillCount(session.id));
    } catch {
      // non-fatal
    }
  }, [session?.id]);

  useEffect(() => {
    void refreshOpenBillCount();
  }, [refreshOpenBillCount, billsRefreshKey, orderId]);

  function bumpBills(): void {
    setBillsRefreshKey((k) => k + 1);
  }

  async function handleTableSelect(table: Table): Promise<void> {
    // Active order with no table yet → persist the assignment server-side
    // (occupies the table). Otherwise it's the new-order flow: stage locally.
    if (orderId && !tableId) {
      try {
        const res = await fetch(`/api/orders/${orderId}/assign-table`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table_id: table.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "Failed to assign table.", "error");
          return;
        }
        setTable(table.id, table.table_number);
        bumpOrder();
        // Reflect the now-occupied table in the floor map.
        setFloors((prev) =>
          prev.map((f) => ({
            ...f,
            tables: f.tables.map((t) =>
              t.id === table.id ? { ...t, status: "occupied" } : t
            ),
          }))
        );
        showToast(`Table ${table.table_number} assigned to this bill.`, "success");
      } catch {
        showToast("Failed to assign table.", "error");
      }
      return;
    }
    setTable(table.id, table.table_number);
  }

  const showToast = useCallback(
    (msg: string, variant: "success" | "error" = "success") => {
      toast({
        title: msg,
        variant: variant === "error" ? "destructive" : "default",
      });
    },
    [toast]
  );

  async function handleSendToKitchen(): Promise<void> {
    if (!session?.id) {
      showToast("No active session.", "error");
      return;
    }
    if (cartItems.length === 0) {
      showToast("Cart is empty.", "error");
      return;
    }

    setSending(true);
    try {
      const itemsPayload = cartItems.map((c) => ({ product_id: c.productId, quantity: c.quantity }));

      // EXISTING active order → add items to the same bill.
      if (orderId) {
        const addRes = await fetch(`/api/orders/${orderId}/add-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: itemsPayload }),
        });
        const addData = await addRes.json();
        if (!addRes.ok) {
          showToast(addData.error ?? "Failed to add items.", "error");
          return;
        }
        updateStatus("sent_to_kitchen");
        clearCart();
        bumpOrder();
        bumpBills();
        showToast("Items added to the bill and sent to kitchen!", "success");
        return;
      }

      // NEW order → create → coupon → send to kitchen.
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          table_id: tableId ?? undefined,
          customer_id: customerId ?? undefined,
          items: itemsPayload,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        showToast(orderData.error ?? "Failed to create order.", "error");
        return;
      }
      const order = orderData.data as { id: string; order_number: string; status: string };

      if (couponCode) {
        await fetch(`/api/orders/${order.id}/apply-coupon`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: couponCode }),
        });
        // Coupon errors are non-fatal — warn but continue
      }

      const kitchenRes = await fetch(`/api/orders/${order.id}/send-to-kitchen`, { method: "POST" });
      const kitchenData = await kitchenRes.json();
      if (!kitchenRes.ok) {
        showToast(kitchenData.error ?? "Failed to send to kitchen.", "error");
        return;
      }

      setOrder(order.id, order.order_number, "sent_to_kitchen");
      clearCart();
      bumpBills();
      showToast(`Order #${order.order_number} sent to kitchen!`, "success");
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setSending(false);
    }
  }

  async function openSession(): Promise<void> {
    const input = window.prompt("Open a new session — opening cash balance (₹)", "0");
    if (input === null) return;
    setSessionBusy(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opening_balance: Number(input) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to open session.", "error");
        return;
      }
      const s = data.data as SessionData;
      setSession(s);
      setStoreSession(s.id);
      setSessionError(null);
      showToast("Session opened — ready to take orders.", "success");
    } catch {
      showToast("Failed to open session.", "error");
    } finally {
      setSessionBusy(false);
    }
  }

  async function closeSession(): Promise<void> {
    if (!session) return;
    if (!confirm("Close the current session? This finalizes the cash drawer.")) return;
    setSessionBusy(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to close session.", "error");
        return;
      }
      setSession(null);
      clearCart();
      setSessionError("No active session. Open one to start taking orders.");
      showToast("Session closed.", "success");
    } catch {
      showToast("Failed to close session.", "error");
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleLogout(): Promise<void> {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-wise-canvas-soft">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-wise-primary border-t-transparent" />
          <p className="mt-3 text-sm text-wise-mute">Loading POS…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-wise-canvas-soft">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-wise-border bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-wise-primary to-wise-primary text-white">
              <Coffee className="h-4 w-4" />
            </span>
            <span className="text-base font-bold text-wise-ink">NexaBrew <span className="text-wise-ink-deep">POS</span></span>
          </span>
          {session ? (
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Session Open
              </span>
              <button
                onClick={() => void closeSession()}
                disabled={sessionBusy}
                className="rounded-md px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Close
              </button>
            </span>
          ) : (
            <button
              onClick={() => void openSession()}
              disabled={sessionBusy}
              className="rounded-full bg-wise-primary px-3 py-0.5 text-xs font-semibold text-wise-ink hover:bg-wise-primary-active disabled:opacity-50"
            >
              {sessionBusy ? "Opening…" : "Open Session"}
            </button>
          )}
          {tableNumber && (
            <span className="rounded-full bg-wise-primary-pale px-2 py-0.5 text-xs font-medium text-wise-ink-deep">
              Table {tableNumber}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpenBillsOpen(true)}
            className="relative flex items-center gap-1 rounded-md px-2 py-1 text-xs text-wise-body hover:text-wise-ink"
          >
            <Receipt className="h-3.5 w-3.5" />
            Open Bills
            {openBillCount > 0 && (
              <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {openBillCount}
              </span>
            )}
          </button>
          <Link
            href="/pos/orders"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-wise-body hover:text-wise-ink"
          >
            <Receipt className="h-3.5 w-3.5" />
            Orders
          </Link>
          <a
            href="/kds"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-wise-body hover:text-wise-ink"
          >
            <ChefHat className="h-3.5 w-3.5" />
            Kitchen Display
          </a>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-wise-body hover:text-wise-ink"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-wise-body hover:text-wise-ink"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </nav>
      </header>

      {/* Session error banner */}
      {sessionError && (
        <div className="flex items-center justify-between gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-700 border-b border-amber-200">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {sessionError}
          </span>
          {!session && (
            <button
              onClick={() => void openSession()}
              disabled={sessionBusy}
              className="shrink-0 rounded-md bg-wise-primary px-3 py-1 text-xs font-semibold text-wise-ink hover:bg-wise-primary-active disabled:opacity-50"
            >
              {sessionBusy ? "Opening…" : "Open Session"}
            </button>
          )}
        </div>
      )}

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Products panel — flex 2 */}
        <div className="flex-[2] overflow-hidden border-r border-wise-border bg-wise-canvas-soft">
          <ProductsPanel products={products} categories={categories} />
        </div>

        {/* Cart panel — flex 1.2 */}
        <div className="flex-[1_1_280px] overflow-hidden">
          <CartPanel
            onTableSelect={() => setTableSelectorOpen(true)}
            onApplyCoupon={() => setCouponDialogOpen(true)}
            onAssignCustomer={() => setCustomerDialogOpen(true)}
            onSendToKitchen={() => void handleSendToKitchen()}
            onNewBill={() => {
              startNewBill();
              bumpBills();
              showToast("Ready for a new bill", "success");
            }}
            onOpenBills={() => setOpenBillsOpen(true)}
            openBillCount={openBillCount}
            sending={sending}
          />
        </div>

        {/* Payment panel — flex 1 */}
        <div className="flex-[1_1_240px] overflow-hidden">
          <PaymentPanel
            onPaymentComplete={() => {
              clearCart();
              bumpBills();
              showToast("Ready for next order!", "success");
            }}
            onNewBill={() => {
              startNewBill();
              bumpBills();
              showToast("Ready for a new bill", "success");
            }}
            onOpenBills={() => setOpenBillsOpen(true)}
            openBillCount={openBillCount}
            toast={showToast}
          />
        </div>
      </div>

      {/* Dialogs */}
      <TableSelectorDialog
        open={tableSelectorOpen}
        onClose={() => setTableSelectorOpen(false)}
        floors={floors}
        onSelect={(t) => void handleTableSelect(t)}
        selectedTableId={tableId}
      />
      <CouponDialog open={couponDialogOpen} onClose={() => setCouponDialogOpen(false)} />
      <CustomerDialog open={customerDialogOpen} onClose={() => setCustomerDialogOpen(false)} />
      <OpenBillsSheet
        open={openBillsOpen}
        onClose={() => setOpenBillsOpen(false)}
        sessionId={session?.id ?? null}
        refreshKey={billsRefreshKey}
        onBillSwitched={bumpBills}
        toast={showToast}
      />
    </div>
  );
}
