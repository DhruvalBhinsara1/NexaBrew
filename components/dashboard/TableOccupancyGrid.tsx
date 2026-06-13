"use client";

import { useState } from "react";
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

interface Props {
  floors: FloorWithTables[];
}

export function TableOccupancyGrid({ floors: initialFloors }: Props): React.ReactElement {
  const { toast } = useToast();
  const [floors, setFloors] = useState(initialFloors);
  const [target, setTarget] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false);

  const nextStatus: TableStatus = target?.status === "occupied" ? "available" : "occupied";

  async function confirmToggle(): Promise<void> {
    if (!target) return;
    setBusy(true);
    try {
      await apiSend(`/api/tables/${target.id}`, "PATCH", { status: nextStatus });
      // Update local state
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
                .map((table) => (
                  <button
                    key={table.id}
                    onClick={() => setTarget(table)}
                    title={`Table ${table.table_number} — ${table.status} (click to toggle)`}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold transition-all hover:ring-2 hover:ring-brand-300 cursor-pointer",
                      table.status === "occupied"
                        ? "bg-brand-500 text-white"
                        : "border border-surface-border bg-surface-muted text-zinc-500"
                    )}
                  >
                    {table.table_number}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-brand-500" />
          Occupied
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-surface-border bg-surface-muted" />
          Available
        </span>
        <span className="text-zinc-400">· click a table to change</span>
      </div>

      {/* Confirmation */}
      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Mark Table {target?.table_number} as {nextStatus}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500">
            {nextStatus === "occupied"
              ? "This marks the table as occupied. Note: tables also occupy automatically when an order is placed on them."
              : "This frees the table. If it has an active order, free it from the POS instead so the order is handled."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmToggle()}
              disabled={busy}
              className={nextStatus === "occupied" ? "bg-brand-500 hover:bg-brand-600" : ""}
              variant={nextStatus === "available" ? "default" : "default"}
            >
              {busy ? "Saving…" : `Mark ${nextStatus}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
