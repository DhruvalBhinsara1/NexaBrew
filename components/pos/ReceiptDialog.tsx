"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Loader2, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { renderReceiptHtml } from "@/lib/receipt/renderReceiptHtml";
import { STORE_INFO } from "@/lib/receipt/storeConfig";
import type { OrderReceipt } from "@/types/domain.types";

interface Props {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  toast?: (msg: string, variant?: "success" | "error") => void;
}

export function ReceiptDialog({ orderId, open, onClose, toast }: Props): React.ReactElement {
  const [html, setHtml] = useState<string>("");
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const build = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/receipt`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Receipt not available");
      const receipt = json.data as OrderReceipt;
      setOrderNumber(receipt.order_number);

      // QR encodes a quick human-readable summary of the bill.
      const qrText = `${STORE_INFO.name} • ${receipt.order_number} • ₹${Number(
        receipt.total_amount
      ).toFixed(2)} • ${receipt.paid_at ?? ""}`;
      let qr: string | undefined;
      try {
        qr = await QRCode.toDataURL(qrText, { margin: 0, width: 144 });
      } catch {
        qr = undefined;
      }
      setHtml(renderReceiptHtml(receipt, qr));
    } catch (e) {
      setError((e as Error).message);
      toast?.((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [orderId, toast]);

  useEffect(() => {
    if (open && orderId) void build();
    if (!open) {
      setHtml("");
      setError(null);
    }
  }, [open, orderId, build]);

  function handlePrint(): void {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  }

  function handleDownload(): void {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${orderNumber || "order"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receipt {orderNumber ? `· ${orderNumber}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[360px] items-center justify-center rounded-lg bg-wise-canvas-soft p-4">
          {loading ? (
            <span className="flex items-center gap-2 text-sm text-wise-mute">
              <Loader2 className="h-4 w-4 animate-spin" /> Brewing your receipt…
            </span>
          ) : error ? (
            <span className="text-sm text-red-500">{error}</span>
          ) : (
            <iframe
              ref={iframeRef}
              title="Receipt preview"
              srcDoc={html}
              className="h-[440px] w-[300px] rounded-md border border-wise-border bg-white shadow-sm"
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={!html || loading}>
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
          <Button onClick={handlePrint} disabled={!html || loading} className="bg-wise-primary hover:bg-wise-primary">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
