"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { Category, ProductWithCategory } from "@/types/domain.types";

interface FormState {
  name: string;
  category_id: string;
  price: string;
  tax_rate: string;
  unit_of_measure: "piece" | "kg" | "litre";
  is_kitchen_display: boolean;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: "",
  category_id: "",
  price: "",
  tax_rate: "0",
  unit_of_measure: "piece",
  is_kitchen_display: true,
  is_active: true,
};

export default function ProductsPage(): React.ReactElement {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        apiGet<ProductWithCategory[]>("/api/products"),
        apiGet<Category[]>("/api/categories"),
      ]);
      setProducts(p);
      setCategories(c);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCat = categoryFilter === "all" || p.category_id === categoryFilter;
        return matchesSearch && matchesCat;
      }),
    [products, search, categoryFilter]
  );

  function openCreate(): void {
    setEditing(null);
    setForm({ ...EMPTY, category_id: categories[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(p: ProductWithCategory): void {
    setEditing(p);
    setForm({
      name: p.name,
      category_id: p.category_id ?? "",
      price: String(p.price),
      tax_rate: String(p.tax_rate),
      unit_of_measure: (p.unit_of_measure as FormState["unit_of_measure"]) ?? "piece",
      is_kitchen_display: p.is_kitchen_display,
      is_active: p.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSave(): Promise<void> {
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        category_id: form.category_id,
        price: Number(form.price),
        tax_rate: Number(form.tax_rate),
        unit_of_measure: form.unit_of_measure,
        is_kitchen_display: form.is_kitchen_display,
      };
      if (editing) {
        await apiSend(`/api/products/${editing.id}`, "PATCH", {
          ...payload,
          is_active: form.is_active,
        });
        toast({ title: "Product updated" });
      } else {
        await apiSend("/api/products", "POST", payload);
        toast({ title: "Product created" });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(p: ProductWithCategory): Promise<void> {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await apiSend(`/api/products/${p.id}`, "DELETE");
      toast({ title: "Product deleted" });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Products"
        subtitle="Manage your menu items"
        action={
          <Button onClick={openCreate} disabled={categories.length === 0} className="bg-brand-500 hover:bg-brand-600">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        }
      />

      {categories.length === 0 && !loading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-700">
            Create at least one category before adding products.
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input className="pl-9" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-surface-border">
        <CardContent className="p-0">
          {filtered.length === 0 && !loading ? (
            <EmptyState icon={Package} title="No products" subtitle="Adjust filters or add a product." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-zinc-400">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Tax</th>
                    <th className="px-4 py-3 text-center">Kitchen</th>
                    <th className="px-4 py-3 text-center">Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-surface-border last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-800">{p.name}</td>
                      <td className="px-4 py-3">
                        {p.category ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: p.category.color ?? "#999" }}
                          >
                            {p.category.name}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700">{formatCurrency(Number(p.price))}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{Number(p.tax_rate)}%</td>
                      <td className="px-4 py-3 text-center">{p.is_kitchen_display ? "✓" : "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-400"}`}>
                          {p.is_active ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="rounded p-1.5 text-zinc-400 hover:bg-surface-muted hover:text-zinc-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => void handleDelete(p)} className="rounded p-1.5 text-red-400 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Price (₹)</Label>
                <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tax rate (%)</Label>
                <Input type="number" min={0} max={100} value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={form.unit_of_measure} onValueChange={(v) => setForm({ ...form, unit_of_measure: v as FormState["unit_of_measure"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="litre">Litre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="kd">Show on kitchen display</Label>
              <Switch id="kd" checked={form.is_kitchen_display} onCheckedChange={(v) => setForm({ ...form, is_kitchen_display: v })} />
            </div>
            {editing && (
              <div className="flex items-center justify-between">
                <Label htmlFor="act">Active</Label>
                <Switch id="act" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={busy || !form.name || !form.category_id || !form.price} className="bg-brand-500 hover:bg-brand-600">
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
