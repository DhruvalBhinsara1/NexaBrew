"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Plus, Search, UserPlus, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
import type { Customer } from "@/types/domain.types";

export default function PosCustomersPage(): React.ReactElement {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (q?: string) => {
    try {
      const url = q ? `/api/customers?search=${encodeURIComponent(q)}` : "/api/customers";
      setCustomers(await apiGet<Customer[]>(url));
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => void load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  async function handleCreate(): Promise<void> {
    setBusy(true);
    try {
      await apiSend("/api/customers", "POST", {
        name,
        email: email || undefined,
        phone: phone || undefined,
      });
      toast({ title: "Customer added" });
      setShowForm(false);
      setName(""); setEmail(""); setPhone("");
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-surface-border bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/pos/terminal" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
            <ArrowLeft className="h-4 w-4" /> Terminal
          </Link>
          <span className="font-semibold text-zinc-800">Customers</span>
        </div>
        <Link href="/pos/orders" className="text-sm text-brand-600 hover:underline">Orders</Link>
      </header>

      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input className="pl-9" placeholder="Search by name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => setShowForm((v) => !v)} className="bg-brand-500 hover:bg-brand-600">
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        </div>

        {/* Inline add form (expands below search per DESIGN.md) */}
        {showForm && (
          <Card className="border-brand-200 bg-brand-50/40">
            <CardContent className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={() => void handleCreate()} disabled={busy || !name} className="w-full bg-brand-500 hover:bg-brand-600">
                  <UserPlus className="mr-2 h-4 w-4" /> {busy ? "Saving…" : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {customers.length === 0 && !loading ? (
          <EmptyState icon={Users} title="No customers" subtitle="Add customers to attach them to orders." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customers.map((c) => (
              <Card key={c.id} className="border-surface-border">
                <CardContent className="py-4">
                  <p className="font-semibold text-zinc-800">{c.name}</p>
                  <div className="mt-2 space-y-1 text-sm text-zinc-500">
                    {c.email && (
                      <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {c.email}</p>
                    )}
                    {c.phone && (
                      <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {c.phone}</p>
                    )}
                    {!c.email && !c.phone && <p className="text-zinc-300">No contact info</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
