"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/store/usePosStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CouponDialog({ open, onClose }: Props): React.ReactElement {
  const couponCode = usePosStore((s) => s.couponCode);
  const setCouponCode = usePosStore((s) => s.setCouponCode);
  const [draft, setDraft] = useState(couponCode);

  function handleApply(): void {
    setCouponCode(draft.trim().toUpperCase());
    onClose();
  }

  function handleClear(): void {
    setDraft("");
    setCouponCode("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-wise-ink-deep" />
            Apply Coupon
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Enter coupon code (e.g. SAVE10)"
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button onClick={handleApply} className="flex-1 bg-wise-primary hover:bg-wise-primary">
              Apply
            </Button>
            {couponCode && (
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-wise-mute">
            Coupon will be validated when the order is sent to kitchen.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
