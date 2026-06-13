"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiSend } from "@/lib/api-client";
import type { FloorWithTables, Table, TableStatus } from "@/types/domain.types";

interface LockedTable {
  tableId: string;
  orderNumber: string;
  status: string;
}

interface Props {
  floors: FloorWithTables[];
  lockedTables?: LockedTable[];
}

export function TableOccupancyGrid({
  floors: initialFloors,
  lockedTables = [],
}: Props): React.ReactElement {
  const { toast } = useToast();
  const [floors, setFloors] = useState(initialFloors);
  const [target, setTarget] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false);

  const lockedByTable = new Map(lockedTables.map((l) => [l.tableId, l]));
  const targetLock = target ? lockedByTable.get(target.id) : undefined;
  const nextStatus: TableStatus = target?.status === "occupied" ? "available" : "occupied";
  // A table can't be freed while it has an active, unpaid order.
  const blockedFromFreeing = nextStatus === "available" && !!targetLock;

  async function confirmToggle(): Promise<void> {
    if (!target || blockedFromFreeing) return;
    setBusy(true);
    try {
      await apiSend(`/api/tables/${target.id}`, "PATCH", { status: nextStatus });
      setFloors((prev) =>
        prev.map((f) => ({
          ...f,
          tables: f.tables.map((t) => (t.id === target.id ? { ...t, status: nextStatus } : t)),
        }))
      );
      toast({ title: `Table ${target.table_number} marked ${nextStatus}` });
      setTarget(null);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {floors.map((floor) => (
          <div key={floor.id}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {floor.name}
            </p>
            <div className="flex flex-wrap gap-2">
              {floor.tables
                .filter((t) => t.is_active)
                .map((table) => {
                  const locked = lockedByTable.has(table.id);
                  return (
                    <button
                      key={table.id}
                      onClick={() => setTarget(table)}
                      title={`Table ${table.table_number} — ${table.status}${locked ? " (active order)" : ""}`}
                      className={cn(
                        "relative flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold transition-all hover:ring-2 hover:ring-brand-300 cursor-pointer",
                        table.status === "occupied"
                          ? "bg-brand-500 text-white"
                          : "border border-surface-border bg-surface-muted text-zinc-500"
                      )}
                    >
                      {table.table_number}
                      {locked && (
                        <Lock className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white p-0.5 text-brand-600 shadow-sm" />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-brand-500" />
          Occupied
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-surface-border bg-surface-muted" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3 text-brand-600" /> active order
        </span>
      </div>

      {/* Confirmation / blocked dialog */}
      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="max-w-sm">
          {blockedFromFreeing ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-brand-600" />
                  Table {target?.table_number} has an unpaid order
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-zinc-500">
                Order <span className="font-medium text-zinc-700">{targetLock?.orderNumber}</span> is{" "}
                <span className="font-medium">{targetLock?.status.replace(/_/g, " ")}</span>. Settle the
                payment or cancel the order first — the table frees automatically when the bill is closed.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTarget(null)}>
                  Close
                </Button>
                <Link href="/pos/orders">
                  <Button className="w-full bg-brand-500 hover:bg-brand-600">
                    Go to Orders &amp; Payments <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  Mark Table {target?.table_number} as {nextStatus}?
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-zinc-500">
                {nextStatus === "occupied"
                  ? "Marks the table occupied. Tables also occupy automatically when an order is sent to the kitchen."
                  : "Frees the table for new guests."}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void confirmToggle()}
                  disabled={busy}
                  className={nextStatus === "occupied" ? "bg-brand-500 hover:bg-brand-600" : ""}
                >
                  {busy ? "Saving…" : `Mark ${nextStatus}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
