"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Receipt, Ticket, Trash2, User, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { usePosStore } from "@/store/usePosStore";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { SlideTextButton } from "@/components/kokonutui";

interface ServerTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

interface BillItem {
  id: string;
  product_name: string;
  quantity: number;
  line_total: string | number;
}

interface Props {
  onTableSelect: () => void;
  onApplyCoupon: () => void;
  onAssignCustomer: () => void;
  onSendToKitchen: () => void;
  onNewBill: () => void;
  onOpenBills: () => void;
  openBillCount: number;
  sending: boolean;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function CartPanel({
  onTableSelect,
  onApplyCoupon,
  onAssignCustomer,
  onSendToKitchen,
  onNewBill,
  onOpenBills,
  openBillCount,
  sending,
}: Props): React.ReactElement {
  const { cartItems, tableNumber, orderId, orderNumber, orderStatus, orderRefresh, couponCode, customerName, setQty, removeItem } =
    usePosStore();

  // Once an order exists it's "active" (sent/payment_pending). The cart then
  // becomes a staging area for items to ADD to the existing bill.
  const isActiveOrder = !!orderId;

  // Once an order exists, the server is the source of truth (it includes the
  // coupon/promotion discount and the discount-aware tax). Fetch and show those
  // real totals instead of the local estimate.
  const [server, setServer] = useState<ServerTotals | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  useEffect(() => {
    if (!orderId) {
      setServer(null);
      setBillItems([]);
      return;
    }
    void fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setServer({
            subtotal: Number(d.data.subtotal),
            discount: Number(d.data.discount_amount),
            tax: Number(d.data.tax_amount),
            total: Number(d.data.total_amount),
          });
          setBillItems((d.data.items as BillItem[] | undefined) ?? []);
        }
      })
      .catch(() => null);
  }, [orderId, orderStatus, orderRefresh]);

  // Client-side estimate (used only while building the cart, before the order
  // is created — no discount yet).
  const estSubtotal = round2(cartItems.reduce((s, c) => s + c.unitPrice * c.quantity, 0));
  const estTax = round2(cartItems.reduce((s, c) => s + c.unitPrice * c.quantity * (c.taxRate / 100), 0));

  const subtotal = server ? server.subtotal : estSubtotal;
  const tax = server ? server.tax : estTax;
  const discount = server ? server.discount : 0;
  const total = server ? server.total : round2(estSubtotal + estTax);

  return (
    <div className="flex h-full flex-col border-l border-surface-border bg-white">
      {/* Header */}
      <div className="border-b border-surface-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-800">
            {orderNumber
              ? `Order #${orderNumber}`
              : tableNumber
                ? `Table ${tableNumber}`
                : "New Order"}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenBills}
              className="relative rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-brand-50 hover:text-brand-700"
            >
              <Receipt className="h-3.5 w-3.5" />
              {openBillCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold text-white">
                  {openBillCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onTableSelect}
              // An active order can still get a table if it has none yet
              // (bill sent to kitchen before a table was chosen). Once a table
              // is assigned, lock it.
              disabled={isActiveOrder && !!tableNumber}
              className="rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            >
              {tableNumber
                ? `T${tableNumber} ✓`
                : isActiveOrder
                  ? "Assign Table"
                  : "Select Table"}
            </button>
          </div>
        </div>
        {customerName && (
          <p className="mt-1 text-xs text-zinc-500">
            Customer: <span className="font-medium text-zinc-700">{customerName}</span>
          </p>
        )}
        {orderStatus && (
          <p className="mt-1 text-xs text-zinc-400">
            Status:{" "}
            <span className="font-medium text-brand-600">{orderStatus.replace(/_/g, " ")}</span>
          </p>
        )}
        {isActiveOrder && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={onNewBill}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            New Bill for Another Customer
          </Button>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        {isActiveOrder && billItems.length > 0 && (
          <>
            {/* Committed items already on the bill */}
            <p className="sticky top-0 z-10 bg-surface-muted/90 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              On this bill
            </p>
            <ul className="divide-y divide-surface-border">
              {billItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-zinc-700">
                    {item.product_name}
                    <span className="ml-1 text-zinc-400">× {item.quantity}</span>
                  </span>
                  <span className="text-sm font-medium text-zinc-600">
                    {formatCurrency(Number(item.line_total))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {isActiveOrder && cartItems.length > 0 && (
          <p className="sticky top-0 z-10 bg-brand-50/90 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
            Adding now
          </p>
        )}

        {cartItems.length === 0 && !isActiveOrder ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <UtensilsCrossed className="h-10 w-10 text-zinc-200" />
            <p className="text-sm text-zinc-400">Cart is empty</p>
            <p className="text-xs text-zinc-300">Click a product to add it</p>
          </div>
        ) : cartItems.length === 0 && isActiveOrder ? (
          <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
            <p className="text-xs text-zinc-400">Click a product to add more items</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {cartItems.map((item) => (
              <li key={item.productId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800">{item.name}</p>
                  <p className="text-xs text-zinc-400">
                    {formatCurrency(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-zinc-800">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQty(item.productId, item.quantity - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-surface-border text-zinc-500 hover:bg-surface-muted"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => setQty(item.productId, item.quantity + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-surface-border text-zinc-500 hover:bg-surface-muted"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Order summary */}
      <div className="border-t border-surface-border px-4 pb-4 pt-3">
        {isActiveOrder ? (
          // Active order: show the confirmed bill, plus any staged additions.
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-zinc-500">
              <span>Bill so far</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-green-600">
                <span className="flex items-center gap-1 text-xs">
                  <Ticket className="h-3 w-3" />
                  {couponCode || "Discount"}
                </span>
                <span>−{formatCurrency(discount)}</span>
              </div>
            )}
            {cartItems.length > 0 && (
              <div className="flex justify-between font-medium text-brand-600">
                <span>Adding (est.)</span>
                <span>+{formatCurrency(round2(estSubtotal + estTax))}</span>
              </div>
            )}
          </div>
        ) : (
          // New order: client-side estimate.
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-zinc-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            {couponCode && (
              <div className="flex items-center justify-between text-green-600">
                <span className="flex items-center gap-1 text-xs">
                  <Ticket className="h-3 w-3" />
                  {couponCode}
                </span>
                <span className="text-xs">applied on send</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between text-base font-bold text-zinc-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {!isActiveOrder && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={onAssignCustomer}>
                <User className="mr-2 h-3.5 w-3.5" />
                {customerName ? customerName.split(" ")[0] : "Customer"}
              </Button>
              <Button variant="outline" size="sm" onClick={onApplyCoupon}>
                <Ticket className="mr-2 h-3.5 w-3.5" />
                {couponCode ? couponCode : "Coupon"}
              </Button>
            </div>
          )}
          <SlideTextButton
            onClick={onSendToKitchen}
            disabled={cartItems.length === 0 || sending}
            loading={sending}
          >
            {isActiveOrder ? "Add to Bill & Send to Kitchen" : "Send to Kitchen"}
          </SlideTextButton>
        </div>
      </div>
    </div>
  );
}
