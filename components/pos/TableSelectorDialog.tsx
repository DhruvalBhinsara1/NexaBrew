"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { FloorWithTables, Table } from "@/types/domain.types";

interface Props {
  open: boolean;
  onClose: () => void;
  floors: FloorWithTables[];
  onSelect: (table: Table) => void;
  selectedTableId?: string | null;
}

export function TableSelectorDialog({
  open,
  onClose,
  floors,
  onSelect,
  selectedTableId,
}: Props): React.ReactElement {
  const firstFloor = floors[0]?.id ?? "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select a Table</DialogTitle>
        </DialogHeader>

        {floors.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">No floors configured.</p>
        ) : (
          <Tabs defaultValue={firstFloor}>
            <TabsList className="mb-4">
              {floors.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {floors.map((floor) => (
              <TabsContent key={floor.id} value={floor.id}>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                  {floor.tables
                    .filter((t) => t.is_active)
                    .map((table) => {
                      const isSelected = table.id === selectedTableId;
                      const isOccupied = table.status === "occupied";
                      return (
                        <button
                          key={table.id}
                          onClick={() => {
                            onSelect(table);
                            onClose();
                          }}
                          className={cn(
                            "rounded-lg border p-3 text-center transition-all",
                            isSelected
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : isOccupied
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-surface-border bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50"
                          )}
                        >
                          <p className="text-lg font-bold">{table.table_number}</p>
                          <p className="text-xs text-zinc-400">{table.seats} seats</p>
                          {isOccupied && (
                            <p className="mt-0.5 text-xs font-medium text-amber-600">Active</p>
                          )}
                        </button>
                      );
                    })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
