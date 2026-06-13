"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Banknote, CheckCircle2, CreditCard, Loader2, Printer, Ticket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { SlideTextButton } from "@/components/kokonutui";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { email?: string; name?: string };
  theme?: { color: string };
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window {
    Razorpay: new (o: RazorpayOptions) => { open(): void };
  }
}

type Method = "razorpay" | "cash";

interface Props {
  orderId: string;
  orderNumber: string;
  total: number;
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
  toast: (msg: string, variant?: "success" | "error") => void;
  customerName?: string | null;
}

export function PaymentDialog({
  orderId,
  orderNumber,
  total,
  open,
  onClose,
  onPaid,
  toast,
  customerName,
}: Props): React.ReactElement {
  const [method, setMethod] = useState<Method>("razorpay");
  const [tendered, setTendered] = useState("");
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [bd, setBd] = useState<{ subtotal: number; discount: number; tax: number; total: number; coupon: string | null } | null>(null);

  useEffect(() => {
    if (open) {
      setPaid(false);
      setTendered("");
      setMethod("razorpay");
      // Fetch the live price breakdown so checkout shows discount + coupon.
      void fetch(`/api/orders/${orderId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.data) {
            setBd({
              subtotal: Number(d.data.subtotal),
              discount: Number(d.data.discount_amount),
              tax: Number(d.data.tax_amount),
              total: Number(d.data.total_amount),
              coupon: d.data.coupon?.code ?? null,
            });
          }
        })
        .catch(() => setBd(null));
    }
  }, [open, orderId]);

  const payTotal = bd?.total ?? total;

  async function payRazorpay(): Promise<void> {
    if (!scriptReady) {
      toast("Razorpay is still loading, try again.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/razorpay`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error ?? "Could not start Razorpay.", "error");
        setLoading(false);
        return;
      }
      const d = json.data;
      const rzp = new window.Razorpay({
        key: d.key_id,
        amount: d.amount,
        currency: d.currency,
        name: "NexaBrew",
        description: `Order #${d.order_number}`,
        order_id: d.razorpay_order_id,
        prefill: { email: d.customer_email ?? undefined, name: d.customer_name ?? undefined },
        theme: { color: "#163300" },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (r) => {
          const pay = await fetch(`/api/orders/${orderId}/payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payment_method_type: "razorpay",
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_order_id: r.razorpay_order_id,
              razorpay_signature: r.razorpay_signature,
            }),
          });
          const pj = await pay.json();
          if (!pay.ok) {
            toast(pj.error ?? "Verification failed.", "error");
            setLoading(false);
            return;
          }
          setPaid(true);
          setLoading(false);
          toast("Payment successful!", "success");
          onPaid();
        },
      });
      rzp.open();
    } catch {
      toast("Failed to open Razorpay.", "error");
      setLoading(false);
    }
  }

  async function payCash(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method_type: "cash", amount_tendered: Number(tendered) }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error ?? "Payment failed.", "error");
        return;
      }
      setPaid(true);
      toast("Cash payment recorded!", "success");
      onPaid();
    } catch {
      toast("Payment failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  const change =
    method === "cash" && Number(tendered) > 0 ? Math.max(0, Number(tendered) - payTotal) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          onReady={() => setScriptReady(true)}
          strategy="lazyOnload"
        />
        <DialogHeader>
          <DialogTitle>
            {paid ? "Payment complete" : `Pay order ${orderNumber}`}
          </DialogTitle>
        </DialogHeader>

        {paid ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <p className="text-sm font-semibold text-wise-ink">Order {orderNumber} is settled.</p>
              <p className="mt-0.5 text-xs text-wise-mute">That hit the spot — thanks a latte! ☕</p>
              {customerName && (
                <p className="mt-1 text-xs text-green-700 font-medium">Customer: {customerName}</p>
              )}
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button variant="outline" onClick={() => setShowReceipt(true)} className="w-full">
                <Printer className="mr-2 h-4 w-4" /> Print Receipt
              </Button>
              <SlideTextButton tone="green" onClick={onClose}>Done</SlideTextButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Price breakdown */}
            <div className="rounded-wise border border-wise-border bg-wise-canvas-soft/50 p-3 text-sm">
              <div className="flex justify-between text-wise-body">
                <span>Original</span>
                <span>{formatCurrency(bd?.subtotal ?? total)}</span>
              </div>
              {bd && bd.discount > 0 && (
                <div className="mt-1 flex justify-between font-medium text-wise-positive-deep">
                  <span className="flex items-center gap-1.5">
                    <Ticket className="h-3.5 w-3.5" />
                    {bd.coupon ?? "Discount"}
                  </span>
                  <span>−{formatCurrency(bd.discount)}</span>
                </div>
              )}
              {bd && (
                <div className="mt-1 flex justify-between text-wise-body">
                  <span>Tax</span>
                  <span>{formatCurrency(bd.tax)}</span>
                </div>
              )}
              <div className="mt-2 flex items-baseline justify-between border-t border-wise-border pt-2">
                <span className="text-sm font-medium text-wise-ink">Total payable</span>
                <span className="font-display text-2xl font-extrabold text-wise-ink">{formatCurrency(payTotal)}</span>
              </div>
            </div>

            <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="space-y-2">
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${method === "razorpay" ? "border-wise-primary bg-wise-primary-pale" : "border-wise-border hover:bg-wise-canvas-soft"}`}>
                <RadioGroupItem value="razorpay" className="sr-only" />
                <CreditCard className={`h-4 w-4 ${method === "razorpay" ? "text-wise-ink-deep" : "text-wise-mute"}`} />
                <div>
                  <p className={`text-sm font-medium ${method === "razorpay" ? "text-wise-ink-deep" : "text-wise-body"}`}>Razorpay</p>
                  <p className="text-xs text-wise-mute">Card · UPI · Netbanking</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${method === "cash" ? "border-wise-primary bg-wise-primary-pale" : "border-wise-border hover:bg-wise-canvas-soft"}`}>
                <RadioGroupItem value="cash" className="sr-only" />
                <Banknote className={`h-4 w-4 ${method === "cash" ? "text-wise-ink-deep" : "text-wise-mute"}`} />
                <span className={`text-sm font-medium ${method === "cash" ? "text-wise-ink-deep" : "text-wise-body"}`}>Cash</span>
              </label>
            </RadioGroup>

            {method === "cash" && (
              <div className="space-y-2">
                <Label className="text-xs text-wise-body">Amount tendered (₹)</Label>
                <Input type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} autoFocus />
                {change !== null && (
                  <div className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                    Change due: {formatCurrency(change)}
                  </div>
                )}
              </div>
            )}

            {method === "razorpay" ? (
              <SlideTextButton onClick={() => void payRazorpay()} loading={loading} disabled={loading || !scriptReady}>
                {loading ? "Opening…" : `Pay ${formatCurrency(payTotal)}`}
              </SlideTextButton>
            ) : (
              <SlideTextButton tone="green" onClick={() => void payCash()} loading={loading} disabled={loading || !tendered || Number(tendered) <= 0}>
                Confirm cash payment
              </SlideTextButton>
            )}

            {loading && method === "razorpay" && (
              <p className="flex items-center justify-center gap-1 text-xs text-wise-mute">
                <Loader2 className="h-3 w-3 animate-spin" /> waiting for Razorpay…
              </p>
            )}
          </div>
        )}
      </DialogContent>

      <ReceiptDialog
        orderId={orderId}
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        toast={toast}
      />
    </Dialog>
  );
}
