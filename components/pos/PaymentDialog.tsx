"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Banknote, CheckCircle2, CreditCard, Loader2, Printer } from "lucide-react";
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

  useEffect(() => {
    if (open) {
      setPaid(false);
      setTendered("");
      setMethod("razorpay");
    }
  }, [open]);

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
        theme: { color: "#d4791f" },
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
    method === "cash" && Number(tendered) > 0 ? Math.max(0, Number(tendered) - total) : null;

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
            <p className="text-2xl font-bold text-wise-ink-deep">{formatCurrency(total)}</p>

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
                {loading ? "Opening…" : `Pay ${formatCurrency(total)}`}
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
