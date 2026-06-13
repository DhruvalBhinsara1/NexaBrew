"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Category } from "@/types/domain.types";

const PRESET_COLORS = [
  "#6F4E37", "#2ECC71", "#3498DB", "#F39C12", "#E91E63", "#9B59B6",
  "#1ABC9C", "#E74C3C", "#34495E", "#F1C40F", "#16A085", "#8E44AD",
];

export default function CategoriesPage(): React.ReactElement {
  const { toast } = useToast();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<Category[]>("/api/categories"));
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(): void {
    setEditing(null);
    setName("");
    setColor(PRESET_COLORS[0]);
    setDialogOpen(true);
  }

  function openEdit(cat: Category): void {
    setEditing(cat);
    setName(cat.name);
    setColor(cat.color ?? PRESET_COLORS[0]);
    setDialogOpen(true);
  }

  async function handleSave(): Promise<void> {
    setBusy(true);
    try {
      if (editing) {
        await apiSend(`/api/categories/${editing.id}`, "PATCH", { name, color });
        toast({ title: "Category updated" });
      } else {
        await apiSend("/api/categories", "POST", { name, color });
        toast({ title: "Category created" });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cat: Category): Promise<void> {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await apiSend(`/api/categories/${cat.id}`, "DELETE");
      toast({ title: "Category deleted" });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Categories"
        subtitle="Organize products into colored groups"
        action={
          <Button onClick={openCreate} className="bg-brand-500 hover:bg-brand-600">
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        }
      />

      {items.length === 0 && !loading ? (
        <EmptyState icon={Tag} title="No categories" subtitle="Add your first category." action={{ label: "Add Category", onClick: openCreate }} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((cat) => (
            <Card key={cat.id} className="group relative overflow-hidden border-surface-border p-4">
              <div className="h-2 w-full rounded-full" style={{ backgroundColor: cat.color ?? "#ccc" }} />
              <p className="mt-3 font-semibold text-zinc-800">{cat.name}</p>
              <p className="text-xs text-zinc-400">{cat.color}</p>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => openEdit(cat)} className="rounded p-1.5 text-zinc-400 hover:bg-surface-muted hover:text-zinc-700">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => void handleDelete(cat)} className="rounded p-1.5 text-red-400 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-md transition-transform ${color === c ? "ring-2 ring-offset-2 ring-brand-500 scale-110" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={busy || !name} className="bg-brand-500 hover:bg-brand-600">
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
