"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
import type { FloorWithTables, Table } from "@/types/domain.types";

export default function FloorsPage(): React.ReactElement {
  const { toast } = useToast();
  const [floors, setFloors] = useState<FloorWithTables[]>([]);
  const [loading, setLoading] = useState(true);
  const [floorDialog, setFloorDialog] = useState(false);
  const [floorName, setFloorName] = useState("");
  const [tableDialog, setTableDialog] = useState<string | null>(null); // floorId
  const [tableNumber, setTableNumber] = useState("");
  const [seats, setSeats] = useState("4");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setFloors(await apiGet<FloorWithTables[]>("/api/floors"));
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddFloor(): Promise<void> {
    setBusy(true);
    try {
      await apiSend("/api/floors", "POST", { name: floorName });
      toast({ title: "Floor added" });
      setFloorDialog(false);
      setFloorName("");
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFloor(floor: FloorWithTables): Promise<void> {
    if (!confirm(`Delete "${floor.name}" and all its tables?`)) return;
    try {
      await apiSend(`/api/floors/${floor.id}`, "DELETE");
      toast({ title: "Floor deleted" });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleAddTable(): Promise<void> {
    if (!tableDialog) return;
    setBusy(true);
    try {
      await apiSend(`/api/floors/${tableDialog}/tables`, "POST", {
        table_number: Number(tableNumber),
        seats: Number(seats),
      });
      toast({ title: "Table added" });
      setTableDialog(null);
      setTableNumber("");
      setSeats("4");
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function toggleTable(table: Table): Promise<void> {
    try {
      await apiSend(`/api/tables/${table.id}`, "PATCH", { is_active: !table.is_active });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Floors & Tables"
        subtitle="Manage your seating layout"
        action={
          <Button onClick={() => setFloorDialog(true)} className="bg-wise-primary hover:bg-wise-primary">
            <Plus className="mr-2 h-4 w-4" /> Add Floor
          </Button>
        }
      />

      {floors.length === 0 && !loading ? (
        <EmptyState icon={LayoutGrid} title="No floors" subtitle="Add a floor to start placing tables." action={{ label: "Add Floor", onClick: () => setFloorDialog(true) }} />
      ) : (
        floors.length > 0 && (
          <Tabs defaultValue={floors[0].id}>
            <TabsList>
              {floors.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>{f.name}</TabsTrigger>
              ))}
            </TabsList>

            {floors.map((floor) => (
              <TabsContent key={floor.id} value={floor.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-wise-mute">{floor.tables.length} tables</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setTableDialog(floor.id)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Table
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => void handleDeleteFloor(floor)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete Floor
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {floor.tables.map((t) => (
                    <Card key={t.id} className={`border-wise-border p-3 text-center ${!t.is_active ? "opacity-50" : ""}`}>
                      <p className="text-lg font-bold text-wise-ink">T{t.table_number}</p>
                      <p className="text-xs text-wise-mute">{t.seats} seats</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${t.status === "occupied" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                        {t.status}
                      </span>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <Switch checked={t.is_active} onCheckedChange={() => void toggleTable(t)} />
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )
      )}

      {/* Add floor dialog */}
      <Dialog open={floorDialog} onOpenChange={setFloorDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Floor</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Floor name</Label>
            <Input value={floorName} onChange={(e) => setFloorName(e.target.value)} placeholder="e.g. Ground Floor" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFloorDialog(false)}>Cancel</Button>
            <Button onClick={() => void handleAddFloor()} disabled={busy || !floorName} className="bg-wise-primary hover:bg-wise-primary">
              {busy ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add table dialog */}
      <Dialog open={!!tableDialog} onOpenChange={(v) => !v && setTableDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Table</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Table number</Label>
              <Input type="number" min={1} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Seats</Label>
              <Input type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTableDialog(null)}>Cancel</Button>
            <Button onClick={() => void handleAddTable()} disabled={busy || !tableNumber} className="bg-wise-primary hover:bg-wise-primary">
              {busy ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
