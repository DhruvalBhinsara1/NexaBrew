"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChefHat,
  CreditCard,
  Loader2,
} from "lucide-react";
import Script from "next/script";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePosStore } from "@/store/usePosStore";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { SlideTextButton } from "@/components/kokonutui";

// Razorpay checkout options shape (minimal — full type in @types/razorpay if needed)
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { email?: string; name?: string };
  theme?: { color: string };
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open(): void };
  }
}

type PaymentMethod = "cash" | "razorpay";

interface Props {
  onPaymentComplete: () => void;
  toast: (msg: string, variant?: "success" | "error") => void;
}

export function PaymentPanel({ onPaymentComplete, toast }: Props): React.ReactElement {
  const { orderId, orderStatus, orderNumber, orderRefresh, reset } = usePosStore();

  const [method, setMethod] = useState<PaymentMethod>("razorpay");
  const [tendered, setTendered] = useState("");
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [rzpScriptReady, setRzpScriptReady] = useState(false);

  // Fetch the live order total once order is known
  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setOrderTotal(Number(d.data.total_amount));
      })
      .catch(() => null);
  }, [orderId, orderRefresh]);

  // ─── Razorpay checkout flow ────────────────────────────────────────────────

  async function openRazorpayCheckout(): Promise<void> {
    if (!orderId || !rzpScriptReady) {
      toast("Razorpay is loading, please try again.", "error");
      return;
    }
    setLoading(true);
    try {
      // 1. Create a Razorpay order on our server
      const res = await fetch(`/api/orders/${orderId}/razorpay`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error ?? "Could not initiate Razorpay.", "error");
        setLoading(false);
        return;
      }
      const { razorpay_order_id, amount, currency, key_id, order_number, customer_email, customer_name } =
        json.data as {
          razorpay_order_id: string;
          amount: number;
          currency: string;
          key_id: string;
          order_number: string;
          customer_email: string | null;
          customer_name: string | null;
        };

      // 2. Open Razorpay checkout modal
      const options: RazorpayOptions = {
        key: key_id,
        amount,
        currency,
        name: "NexaBrew",
        description: `Order #${order_number}`,
        order_id: razorpay_order_id,
        prefill: {
          email: customer_email ?? undefined,
          name: customer_name ?? undefined,
        },
        theme: { color: "#d4791f" },
        modal: {
          ondismiss: () => setLoading(false),
        },
        handler: async (response) => {
          // 3. Verify signature and record payment on our server
          const payRes = await fetch(`/api/orders/${orderId}/payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payment_method_type: "razorpay",
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const payJson = await payRes.json();
          if (!payRes.ok) {
            toast(payJson.error ?? "Payment verification failed.", "error");
            setLoading(false);
            return;
          }
          setPaid(true);
          setLoading(false);
          toast("Payment successful!", "success");
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      toast("Failed to open Razorpay. Please try again.", "error");
      setLoading(false);
    }
  }

  // ─── Cash payment flow ─────────────────────────────────────────────────────

  async function handleCashPay(): Promise<void> {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method_type: "cash",
          amount_tendered: Number(tendered),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Payment failed.", "error");
        return;
      }
      setPaid(true);
      toast("Cash payment recorded!", "success");
    } catch {
      toast("Payment failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleNewOrder(): void {
    setPaid(false);
    setTendered("");
    setOrderTotal(null);
    reset();
    onPaymentComplete();
  }

  // ─── Panel states ──────────────────────────────────────────────────────────

  if (!orderStatus || orderStatus === "draft") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 border-l border-surface-border bg-surface-muted p-6 text-center">
        <div className="rounded-full bg-white p-4 shadow-sm">
          <ChefHat className="h-8 w-8 text-zinc-300" />
        </div>
        <p className="text-sm font-medium text-zinc-500">
          Add items and send to kitchen to proceed
        </p>
      </div>
    );
  }

  if (orderStatus === "sent_to_kitchen") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 border-l border-surface-border bg-surface-muted p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        <div>
          <p className="font-semibold text-zinc-700">Order #{orderNumber}</p>
          <p className="mt-1 text-sm text-zinc-400">Waiting for kitchen…</p>
        </div>
        <p className="text-xs text-zinc-400">
          Payment panel activates when kitchen marks order ready.
        </p>
      </div>
    );
  }

  if (orderStatus === "paid" || paid) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 border-l border-surface-border bg-green-50 p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <div>
          <p className="text-lg font-bold text-green-800">Payment Complete!</p>
          <p className="mt-1 text-sm text-green-600">Order #{orderNumber} settled.</p>
        </div>
        <SlideTextButton tone="green" onClick={handleNewOrder} className="mt-4">
          Start New Order
        </SlideTextButton>
      </div>
    );
  }

  if (orderStatus !== "payment_pending") {
    return (
      <div className="flex h-full items-center justify-center border-l border-surface-border bg-surface-muted p-6 text-center">
        <p className="text-sm text-zinc-400">{orderStatus?.replace(/_/g, " ")}</p>
      </div>
    );
  }

  // ─── Payment form ──────────────────────────────────────────────────────────

  const changeDue =
    method === "cash" && orderTotal !== null && Number(tendered) > 0
      ? Math.max(0, Number(tendered) - orderTotal)
      : null;

  return (
    <>
      {/* Load Razorpay checkout script once */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => setRzpScriptReady(true)}
        strategy="lazyOnload"
      />

      <div className="flex h-full flex-col border-l border-surface-border bg-white">
        <div className="border-b border-surface-border px-4 py-3">
          <h2 className="font-semibold text-zinc-800">Payment</h2>
          {orderTotal !== null && (
            <p className="text-2xl font-bold text-brand-600">{formatCurrency(orderTotal)}</p>
          )}
          <p className="text-xs text-zinc-400">Order #{orderNumber}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <RadioGroup
            value={method}
            onValueChange={(v) => setMethod(v as PaymentMethod)}
            className="space-y-2"
          >
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                method === "razorpay"
                  ? "border-brand-400 bg-brand-50"
                  : "border-surface-border hover:bg-surface-muted"
              }`}
            >
              <RadioGroupItem value="razorpay" id="pm-razorpay" className="sr-only" />
              <CreditCard
                className={`h-4 w-4 ${method === "razorpay" ? "text-brand-600" : "text-zinc-400"}`}
              />
              <div>
                <p
                  className={`text-sm font-medium ${method === "razorpay" ? "text-brand-700" : "text-zinc-600"}`}
                >
                  Razorpay
                </p>
                <p className="text-xs text-zinc-400">Card · UPI · Netbanking · Wallets</p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                method === "cash"
                  ? "border-brand-400 bg-brand-50"
                  : "border-surface-border hover:bg-surface-muted"
              }`}
            >
              <RadioGroupItem value="cash" id="pm-cash" className="sr-only" />
              <Banknote
                className={`h-4 w-4 ${method === "cash" ? "text-brand-600" : "text-zinc-400"}`}
              />
              <span
                className={`text-sm font-medium ${method === "cash" ? "text-brand-700" : "text-zinc-600"}`}
              >
                Cash
              </span>
            </label>
          </RadioGroup>

          {method === "cash" && (
            <div className="space-y-2">
              <Label className="text-xs text-zinc-500">Amount Tendered (₹)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0.00"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                autoFocus
              />
              {changeDue !== null && (
                <div className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  Change Due: {formatCurrency(changeDue)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-surface-border p-4">
          {method === "razorpay" ? (
            <SlideTextButton
              onClick={() => void openRazorpayCheckout()}
              loading={loading}
              disabled={loading || !rzpScriptReady}
            >
              {loading ? "Opening…" : `Pay ${orderTotal ? formatCurrency(orderTotal) : ""} via Razorpay`}
            </SlideTextButton>
          ) : (
            <SlideTextButton
              tone="green"
              onClick={() => void handleCashPay()}
              loading={loading}
              disabled={loading || !tendered || Number(tendered) <= 0}
            >
              Confirm Cash Payment
            </SlideTextButton>
          )}
        </div>
      </div>
    </>
  );
}
