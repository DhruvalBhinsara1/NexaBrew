"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Receipt, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { usePosStore } from "@/store/usePosStore";
import type { OrderStatus, OrderWithItems } from "@/types/domain.types";

const OPEN_STATUSES: OrderStatus[] = ["draft", "sent_to_kitchen", "payment_pending"];

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent_to_kitchen: "In Kitchen",
  payment_pending: "Awaiting Payment",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent_to_kitchen: "bg-blue-100 text-blue-700",
  payment_pending: "bg-amber-100 text-amber-700",
};

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  refreshKey: number;
  onBillSwitched?: () => void;
  toast: (msg: string, variant?: "success" | "error") => void;
}

export function OpenBillsSheet({
  open,
  onClose,
  sessionId,
  refreshKey,
  onBillSwitched,
  toast,
}: Props): React.ReactElement {
  const { orderId, loadOrder, startNewBill } = usePosStore();
  const [bills, setBills] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBills = useCallback(async () => {
    if (!sessionId) {
      setBills([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?session_id=${sessionId}`);
      const json = await res.json();
      const all = (json.data as OrderWithItems[] | undefined) ?? [];
      setBills(all.filter((o) => OPEN_STATUSES.includes(o.status as OrderStatus)));
    } catch {
      toast("Failed to load open bills.", "error");
    } finally {
      setLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    if (open) void fetchBills();
  }, [open, fetchBills, refreshKey]);

  function handleSelectBill(bill: OrderWithItems): void {
    loadOrder({
      id: bill.id,
      orderNumber: bill.order_number,
      status: bill.status,
      customerId: bill.customer?.id ?? null,
      customerName: bill.customer?.name ?? null,
      tableId: bill.table?.id ?? null,
      tableNumber: bill.table?.table_number ?? null,
      couponCode: bill.coupon?.code ?? "",
    });
    onBillSwitched?.();
    onClose();
    toast(`Switched to order #${bill.order_number}`, "success");
  }

  function handleNewBill(): void {
    startNewBill();
    onBillSwitched?.();
    onClose();
    toast("Ready for a new bill", "success");
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-brand-600" />
            Open Bills
          </SheetTitle>
        </SheetHeader>

        <p className="mt-1 text-sm text-zinc-500">
          Switch between unpaid bills or start a new one for another customer.
        </p>

        <Button
          className="mt-4 w-full bg-brand-500 hover:bg-brand-600"
          onClick={handleNewBill}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Bill
        </Button>

        <div className="mt-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
              Loading bills…
            </div>
          ) : bills.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Receipt className="h-10 w-10 text-zinc-200" />
              <p className="text-sm text-zinc-500">No open bills</p>
              <p className="text-xs text-zinc-400">Start a new order from the cart</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {bills.map((bill) => {
                const isActive = bill.id === orderId;
                return (
                  <li key={bill.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectBill(bill)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        isActive
                          ? "border-brand-400 bg-brand-50 ring-1 ring-brand-200"
                          : "border-surface-border hover:border-brand-200 hover:bg-surface-muted"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-800">
                            #{bill.order_number}
                            {isActive && (
                              <span className="ml-2 text-xs font-medium text-brand-600">
                                (current)
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-zinc-500">
                            <User className="h-3 w-3 shrink-0" />
                            {bill.customer?.name ?? "Walk-in"}
                            {bill.table && (
                              <span className="text-zinc-400"> · T{bill.table.table_number}</span>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold text-zinc-800">
                            {formatCurrency(Number(bill.total_amount))}
                          </p>
                          <span
                            className={cn(
                              "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                              STATUS_BADGE[bill.status] ?? "bg-zinc-100"
                            )}
                          >
                            {STATUS_LABEL[bill.status] ?? bill.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Count of open bills for the current session (excluding the active order is optional). */
export async function fetchOpenBillCount(sessionId: string): Promise<number> {
  const res = await fetch(`/api/orders?session_id=${sessionId}`);
  const json = await res.json();
  const all = (json.data as OrderWithItems[] | undefined) ?? [];
  return all.filter((o) => OPEN_STATUSES.includes(o.status as OrderStatus)).length;
}
