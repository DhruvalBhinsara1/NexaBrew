"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
import type { PaymentMethod } from "@/types/domain.types";

const ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  upi: Smartphone,
};

const LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
};

export default function PaymentMethodsPage(): React.ReactElement {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [upiDraft, setUpiDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<PaymentMethod[]>("/api/payment-methods");
      setMethods(data);
      const drafts: Record<string, string> = {};
      data.forEach((m) => { if (m.type === "upi") drafts[m.id] = m.upi_id ?? ""; });
      setUpiDraft(drafts);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(m: PaymentMethod): Promise<void> {
    try {
      await apiSend(`/api/payment-methods/${m.id}`, "PATCH", { is_enabled: !m.is_enabled });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  async function saveUpi(m: PaymentMethod): Promise<void> {
    try {
      await apiSend(`/api/payment-methods/${m.id}`, "PATCH", { upi_id: upiDraft[m.id] || null });
      toast({ title: "UPI ID saved" });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Payment Methods" subtitle="Enable and configure how customers pay" />

      {loading ? (
        <p className="text-sm text-wise-mute">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {methods.map((m) => {
            const Icon = ICONS[m.type] ?? CreditCard;
            return (
              <Card key={m.id} className="border-wise-border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 text-wise-ink-deep" />
                    {LABELS[m.type] ?? m.type}
                  </CardTitle>
                  <Switch checked={m.is_enabled} onCheckedChange={() => void toggle(m)} />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-wise-mute">
                    {m.is_enabled ? "Accepting payments" : "Disabled"}
                  </p>
                  {m.type === "upi" && m.is_enabled && (
                    <div className="mt-3 space-y-2">
                      <Label className="text-xs">UPI ID</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="name@bank"
                          value={upiDraft[m.id] ?? ""}
                          onChange={(e) => setUpiDraft({ ...upiDraft, [m.id]: e.target.value })}
                        />
                        <Button size="sm" onClick={() => void saveUpi(m)} className="bg-wise-primary hover:bg-wise-primary">
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-wise-mute">
        Note: live customer payments go through Razorpay (configured via environment keys).
        These toggles control which tender types the POS records.
      </p>
    </div>
  );
}
