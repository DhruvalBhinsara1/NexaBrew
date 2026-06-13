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
  const [sending, setSending] = useState(false);

  // Store
  const {
    setSession: setStoreSession,
    tableId, tableNumber, setTable,
    cartItems, couponCode, clearCart,
    customerId,
    orderId,
    setOrder, updateStatus, bumpOrder,
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
          setSessionError("No active session. Ask an admin to open one.");
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

  function handleTableSelect(table: Table): void {
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
      showToast(`Order #${order.order_number} sent to kitchen!`, "success");
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleLogout(): Promise<void> {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-muted">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="mt-3 text-sm text-zinc-400">Loading POS…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-muted">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-surface-border bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Coffee className="h-4 w-4" />
            </span>
            <span className="text-base font-bold text-zinc-900">NexaBrew <span className="text-brand-600">POS</span></span>
          </span>
          {session ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Session Open
            </span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
              No Session
            </span>
          )}
          {tableNumber && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              Table {tableNumber}
            </span>
          )}
        </div>

        <nav className="flex items-center gap-3">
          <Link
            href="/pos/orders"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800"
          >
            <Receipt className="h-3.5 w-3.5" />
            Orders
          </Link>
          <a
            href="/kds"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800"
          >
            <ChefHat className="h-3.5 w-3.5" />
            Kitchen Display
          </a>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </nav>
      </header>

      {/* Session error banner */}
      {sessionError && (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-700 border-b border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {sessionError}
        </div>
      )}

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Products panel — flex 2 */}
        <div className="flex-[2] overflow-hidden border-r border-surface-border bg-surface-muted">
          <ProductsPanel products={products} categories={categories} />
        </div>

        {/* Cart panel — flex 1.2 */}
        <div className="flex-[1_1_280px] overflow-hidden">
          <CartPanel
            onTableSelect={() => setTableSelectorOpen(true)}
            onApplyCoupon={() => setCouponDialogOpen(true)}
            onAssignCustomer={() => setCustomerDialogOpen(true)}
            onSendToKitchen={() => void handleSendToKitchen()}
            sending={sending}
          />
        </div>

        {/* Payment panel — flex 1 */}
        <div className="flex-[1_1_240px] overflow-hidden">
          <PaymentPanel
            onPaymentComplete={() => {
              clearCart();
              showToast("Ready for next order!", "success");
            }}
            toast={showToast}
          />
        </div>
      </div>

      {/* Dialogs */}
      <TableSelectorDialog
        open={tableSelectorOpen}
        onClose={() => setTableSelectorOpen(false)}
        floors={floors}
        onSelect={handleTableSelect}
        selectedTableId={tableId}
      />
      <CouponDialog open={couponDialogOpen} onClose={() => setCouponDialogOpen(false)} />
      <CustomerDialog open={customerDialogOpen} onClose={() => setCustomerDialogOpen(false)} />
    </div>
  );
}
