"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Ticket, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
import type { Coupon, Promotion, Product } from "@/types/domain.types";

function discountLabel(type: string, value: number): string {
  return type === "percentage" ? `${value}%` : `₹${value}`;
}

export default function CouponsPage(): React.ReactElement {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Coupon form
  const [couponDialog, setCouponDialog] = useState(false);
  const [cCode, setCCode] = useState("");
  const [cType, setCType] = useState<"percentage" | "fixed">("percentage");
  const [cValue, setCValue] = useState("");
  const [cMaxUses, setCMaxUses] = useState("");

  // Promotion form
  const [promoDialog, setPromoDialog] = useState(false);
  const [pName, setPName] = useState("");
  const [pApplies, setPApplies] = useState<"product" | "order">("order");
  const [pProduct, setPProduct] = useState("");
  const [pMinQty, setPMinQty] = useState("");
  const [pMinOrder, setPMinOrder] = useState("");
  const [pType, setPType] = useState<"percentage" | "fixed">("percentage");
  const [pValue, setPValue] = useState("");

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p, pr] = await Promise.all([
        apiGet<Coupon[]>("/api/coupons"),
        apiGet<Promotion[]>("/api/promotions"),
        apiGet<Product[]>("/api/products"),
      ]);
      setCoupons(c);
      setPromotions(p);
      setProducts(pr);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCoupon(): Promise<void> {
    setBusy(true);
    try {
      await apiSend("/api/coupons", "POST", {
        code: cCode,
        discount_type: cType,
        discount_value: Number(cValue),
        max_uses: cMaxUses ? Number(cMaxUses) : null,
      });
      toast({ title: "Coupon created" });
      setCouponDialog(false);
      setCCode(""); setCValue(""); setCMaxUses("");
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function createPromotion(): Promise<void> {
    setBusy(true);
    try {
      const payload =
        pApplies === "product"
          ? {
              name: pName,
              applies_to: "product",
              product_id: pProduct,
              min_quantity: Number(pMinQty),
              discount_type: pType,
              discount_value: Number(pValue),
            }
          : {
              name: pName,
              applies_to: "order",
              min_order_amount: Number(pMinOrder),
              discount_type: pType,
              discount_value: Number(pValue),
            };
      await apiSend("/api/promotions", "POST", payload);
      toast({ title: "Promotion created" });
      setPromoDialog(false);
      setPName(""); setPProduct(""); setPMinQty(""); setPMinOrder(""); setPValue("");
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function toggleCoupon(c: Coupon): Promise<void> {
    try {
      await apiSend(`/api/coupons/${c.id}`, "PATCH", { is_active: !c.is_active });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  async function togglePromo(p: Promotion): Promise<void> {
    try {
      await apiSend(`/api/promotions/${p.id}`, "PATCH", { is_active: !p.is_active });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  async function deleteCoupon(c: Coupon): Promise<void> {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await apiSend(`/api/coupons/${c.id}`, "DELETE");
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  async function deletePromo(p: Promotion): Promise<void> {
    if (!confirm(`Delete promotion ${p.name}?`)) return;
    try {
      await apiSend(`/api/promotions/${p.id}`, "DELETE");
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Coupons & Promotions" subtitle="Discount codes and automated offers" />

      {/* Coupons */}
      <Card className="border-wise-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4 text-wise-ink-deep" /> Coupon Codes
          </CardTitle>
          <Button size="sm" onClick={() => setCouponDialog(true)} className="bg-wise-primary hover:bg-wise-primary">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Coupon
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {coupons.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-wise-mute">No coupons yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wise-border text-xs uppercase tracking-wider text-wise-mute">
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Discount</th>
                  <th className="px-4 py-2 text-center">Uses</th>
                  <th className="px-4 py-2 text-center">Active</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b border-wise-border last:border-0">
                    <td className="px-4 py-2 font-mono font-medium text-wise-ink">{c.code}</td>
                    <td className="px-4 py-2 text-wise-body">{discountLabel(c.discount_type, Number(c.discount_value))}</td>
                    <td className="px-4 py-2 text-center text-wise-body">
                      {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Switch checked={c.is_active} onCheckedChange={() => void toggleCoupon(c)} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => void deleteCoupon(c)} className="rounded p-1.5 text-red-400 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Promotions */}
      <Card className="border-wise-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Automated Promotions</CardTitle>
          <Button size="sm" onClick={() => setPromoDialog(true)} className="bg-wise-primary hover:bg-wise-primary">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Promotion
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {promotions.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-wise-mute">No promotions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wise-border text-xs uppercase tracking-wider text-wise-mute">
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Applies To</th>
                  <th className="px-4 py-2 text-left">Condition</th>
                  <th className="px-4 py-2 text-left">Discount</th>
                  <th className="px-4 py-2 text-center">Active</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.id} className="border-b border-wise-border last:border-0">
                    <td className="px-4 py-2 font-medium text-wise-ink">{p.name}</td>
                    <td className="px-4 py-2 text-wise-body">{p.applies_to}</td>
                    <td className="px-4 py-2 text-wise-body">
                      {p.applies_to === "product" ? `Min qty ${p.min_quantity}` : `Min order ₹${p.min_order_amount}`}
                    </td>
                    <td className="px-4 py-2 text-wise-body">{discountLabel(p.discount_type, Number(p.discount_value))}</td>
                    <td className="px-4 py-2 text-center">
                      <Switch checked={p.is_active} onCheckedChange={() => void togglePromo(p)} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => void deletePromo(p)} className="rounded p-1.5 text-red-400 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Coupon dialog */}
      <Dialog open={couponDialog} onOpenChange={setCouponDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Coupon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={cCode} onChange={(e) => setCCode(e.target.value.toUpperCase())} placeholder="SAVE10" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={cType} onValueChange={(v) => setCType(v as "percentage" | "fixed")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed ₹</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" min={0} value={cValue} onChange={(e) => setCValue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max uses (optional)</Label>
              <Input type="number" min={1} value={cMaxUses} onChange={(e) => setCMaxUses(e.target.value)} placeholder="Unlimited" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialog(false)}>Cancel</Button>
            <Button onClick={() => void createCoupon()} disabled={busy || !cCode || !cValue} className="bg-wise-primary hover:bg-wise-primary">
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promotion dialog */}
      <Dialog open={promoDialog} onOpenChange={setPromoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Promotion</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Big Order Reward" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Applies to</Label>
              <Select value={pApplies} onValueChange={(v) => setPApplies(v as "product" | "order")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Whole order</SelectItem>
                  <SelectItem value="product">Specific product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pApplies === "product" ? (
              <>
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={pProduct} onValueChange={setPProduct}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((pr) => (
                        <SelectItem key={pr.id} value={pr.id}>{pr.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Minimum quantity</Label>
                  <Input type="number" min={1} value={pMinQty} onChange={(e) => setPMinQty(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Minimum order amount (₹)</Label>
                <Input type="number" min={1} value={pMinOrder} onChange={(e) => setPMinOrder(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Discount type</Label>
                <Select value={pType} onValueChange={(v) => setPType(v as "percentage" | "fixed")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed ₹</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" min={0} value={pValue} onChange={(e) => setPValue(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoDialog(false)}>Cancel</Button>
            <Button
              onClick={() => void createPromotion()}
              disabled={busy || !pName || !pValue || (pApplies === "product" ? !pProduct || !pMinQty : !pMinOrder)}
              className="bg-wise-primary hover:bg-wise-primary"
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
