"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChefHat, CreditCard, Loader2, Smartphone, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePosStore } from "@/store/usePosStore";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { SlideTextButton } from "@/components/kokonutui";

interface Props {
  onPaymentComplete: () => void;
  toast: (msg: string, variant?: "success" | "error") => void;
}

type PaymentMethod = "cash" | "card" | "upi";

export function PaymentPanel({ onPaymentComplete, toast }: Props): React.ReactElement {
  const { orderId, orderStatus, orderNumber, reset } = usePosStore();

  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);

  // Fetch the order total once we know the orderId
  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setOrderTotal(Number(d.data.total_amount));
      })
      .catch(() => null);
  }, [orderId]);

  // Fetch UPI QR when method changes to upi
  useEffect(() => {
    if (method !== "upi" || !orderId) return;
    fetch(`/api/orders/${orderId}/payment/upi-qr`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.qr_data_url) setQrUrl(d.data.qr_data_url);
      })
      .catch(() => null);
  }, [method, orderId]);

  async function handlePay(): Promise<void> {
    if (!orderId) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = { payment_method_type: method };
      if (method === "cash") body.amount_tendered = Number(tendered) || 0;
      if (method === "card") body.transaction_reference = txnRef;

      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Payment failed", "error");
        return;
      }
      setPaid(true);
      toast("Payment successful!", "success");
    } catch {
      toast("Payment failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleNewOrder(): void {
    setPaid(false);
    setTendered("");
    setTxnRef("");
    setQrUrl(null);
    setOrderTotal(null);
    reset();
    onPaymentComplete();
  }

  // Waiting for kitchen to complete
  if (!orderStatus || orderStatus === "draft") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 border-l border-surface-border bg-surface-muted p-6 text-center">
        <div className="rounded-full bg-white p-4 shadow-sm">
          <ChefHat className="h-8 w-8 text-zinc-300" />
        </div>
        <p className="text-sm font-medium text-zinc-500">
          Add items to cart and send to kitchen
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
          <p className="mt-1 text-sm text-zinc-400">Waiting for kitchen to complete…</p>
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
          <p className="mt-1 text-sm text-green-600">Order #{orderNumber} has been settled.</p>
        </div>
        <Button
          onClick={handleNewOrder}
          className="mt-4 bg-brand-500 hover:bg-brand-600"
        >
          Start New Order
        </Button>
      </div>
    );
  }

  if (orderStatus !== "payment_pending") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 border-l border-surface-border bg-surface-muted p-6 text-center">
        <p className="text-sm text-zinc-400">
          Order status: {orderStatus?.replace(/_/g, " ")}
        </p>
      </div>
    );
  }

  // Payment pending — show payment form
  const changeDue =
    method === "cash" && orderTotal !== null && Number(tendered) > 0
      ? Math.max(0, Number(tendered) - orderTotal)
      : null;

  return (
    <div className="flex h-full flex-col border-l border-surface-border bg-white">
      <div className="border-b border-surface-border px-4 py-3">
        <h2 className="font-semibold text-zinc-800">Payment</h2>
        {orderTotal !== null && (
          <p className="text-xl font-bold text-brand-600">{formatCurrency(orderTotal)}</p>
        )}
        <p className="text-xs text-zinc-400">Order #{orderNumber}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <RadioGroup
          value={method}
          onValueChange={(v) => setMethod(v as PaymentMethod)}
          className="space-y-2"
        >
          {[
            { value: "cash", label: "Cash", icon: Banknote },
            { value: "card", label: "Card", icon: CreditCard },
            { value: "upi", label: "UPI", icon: Smartphone },
          ].map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                method === value
                  ? "border-brand-400 bg-brand-50"
                  : "border-surface-border hover:bg-surface-muted"
              }`}
            >
              <RadioGroupItem value={value} id={`pm-${value}`} className="sr-only" />
              <Icon
                className={`h-4 w-4 ${method === value ? "text-brand-600" : "text-zinc-400"}`}
              />
              <span
                className={`text-sm font-medium ${method === value ? "text-brand-700" : "text-zinc-600"}`}
              >
                {label}
              </span>
            </label>
          ))}
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
            />
            {changeDue !== null && (
              <div className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                Change Due: {formatCurrency(changeDue)}
              </div>
            )}
          </div>
        )}

        {method === "card" && (
          <div className="space-y-2">
            <Label className="text-xs text-zinc-500">Transaction Reference</Label>
            <Input
              placeholder="e.g. TXN1234567890"
              value={txnRef}
              onChange={(e) => setTxnRef(e.target.value)}
            />
          </div>
        )}

        {method === "upi" && (
          <div className="flex flex-col items-center gap-2 py-2">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="UPI QR Code" className="h-40 w-40 rounded-lg border" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-lg border bg-surface-muted">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
              </div>
            )}
            <p className="text-xs text-zinc-400">Scan with any UPI app to pay</p>
          </div>
        )}
      </div>

      <div className="border-t border-surface-border p-4">
        <SlideTextButton
          tone="green"
          onClick={() => void handlePay()}
          loading={loading}
          disabled={loading}
        >
          Process Payment
        </SlideTextButton>
      </div>
    </div>
  );
}
