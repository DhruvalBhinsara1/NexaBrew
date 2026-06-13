"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FloorWithTables } from "@/types/domain.types";

interface Props {
  occupiedCount: number;
  totalTables: number;
  floors: FloorWithTables[];
  lockedTableIds: string[];
  href: string;
}

/**
 * KPI card that reveals an animated mini floor-plan on hover — a quick
 * "where is everyone seated" glance without leaving the dashboard.
 */
export function TablesOccupiedCard({
  occupiedCount,
  totalTables,
  floors,
  lockedTableIds,
  href,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const locked = new Set(lockedTableIds);
  const available = totalTables - occupiedCount;
  const pct = totalTables > 0 ? Math.round((occupiedCount / totalTables) * 100) : 0;
  const activeTables = floors.flatMap((f) => f.tables.filter((t) => t.is_active));

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link href={href} className="block">
        <Card className="border-wise-border bg-white shadow-sm transition-all duration-300 hover:border-wise-primary hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-wise-body">Tables Occupied</CardTitle>
            <LayoutGrid
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                open ? "scale-110 text-wise-ink-deep" : "text-wise-ink-deep"
              )}
            />
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-extrabold tracking-tight text-wise-ink">
              {occupiedCount} <span className="text-wise-mute">/</span> {totalTables}
            </p>
            <p className="mt-0.5 text-xs text-wise-mute">{available} available</p>
            {/* Occupancy bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-wise-canvas-soft">
              <div
                className="h-full rounded-full bg-gradient-to-r from-wise-primary to-wise-primary transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Hover floor-plan popover — anchored to the right (this is the
          right-most KPI card) so it never spills off-screen. */}
      <div
        className={cn(
          "absolute right-0 top-full z-50 mt-2 w-[min(384px,calc(100vw-3rem))] origin-top-right",
          "transition-all duration-300 ease-out",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        )}
      >
        <div className="overflow-hidden rounded-2xl border border-wise-border bg-white shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-wise-border bg-gradient-to-r from-wise-canvas-soft/80 to-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-wise-ink">Floor Plan</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-wise-mute">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                {pct}% occupied · live
              </p>
            </div>
            <span className="rounded-full bg-wise-primary-pale px-2.5 py-1 text-xs font-semibold text-wise-ink-deep ring-1 ring-wise-primary">
              {occupiedCount}/{totalTables}
            </span>
          </div>

          {/* Floors */}
          <div className="max-h-[340px] space-y-4 overflow-y-auto p-4">
            {activeTables.length === 0 ? (
              <p className="py-6 text-center text-sm text-wise-mute">No tables configured.</p>
            ) : (
              floors.map((floor) => {
                const tables = floor.tables.filter((t) => t.is_active);
                if (tables.length === 0) return null;
                return (
                  <div key={floor.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-wise-mute">
                        {floor.name}
                      </p>
                      <span className="text-[10px] font-medium text-wise-mute">
                        {tables.filter((t) => t.status === "occupied").length}/{tables.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {tables.map((table, i) => {
                        const isOccupied = table.status === "occupied";
                        const isLocked = locked.has(table.id);
                        return (
                          <div
                            key={table.id}
                            title={`Table ${table.table_number} — ${isLocked ? "active order" : table.status}`}
                            style={{ transitionDelay: open ? `${Math.min(i, 14) * 25}ms` : "0ms" }}
                            className={cn(
                              "relative flex aspect-square items-center justify-center rounded-lg text-xs font-bold transition-all duration-300",
                              open ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-90 opacity-0",
                              isLocked
                                ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                                : isOccupied
                                  ? "bg-wise-primary text-wise-ink shadow-sm hover:shadow-md"
                                  : "border border-dashed border-wise-border bg-wise-canvas-soft/60 text-wise-mute hover:border-wise-border"
                            )}
                          >
                            {table.table_number}
                            {isLocked && (
                              <Lock className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-amber-600 shadow-sm" />
                            )}
                            {isOccupied && !isLocked && (
                              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wise-primary opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-wise-primary ring-2 ring-white" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 border-t border-wise-border bg-wise-canvas-soft/30 px-4 py-2.5 text-[11px] text-wise-body">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-gradient-to-br from-wise-primary to-wise-primary" /> Occupied
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-dashed border-wise-border bg-wise-canvas-soft" /> Free
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-amber-600" /> Unpaid bill
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
