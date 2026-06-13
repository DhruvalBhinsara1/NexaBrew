"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Phone, Plus, Search, UserPlus, Users } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
import type { Customer } from "@/types/domain.types";

const PER_PAGE = 9;

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
  const [page, setPage] = useState(1);

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

  // Debounced search (resets to first page)
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const totalPages = Math.max(1, Math.ceil(customers.length / PER_PAGE));
  const paged = useMemo(
    () => customers.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [customers, page]
  );

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
    <div className="flex min-h-screen bg-wise-canvas-soft">
      <DashboardSidebar />

      <main className="flex-1 overflow-auto">
        <div className="space-y-6 p-6">
          <PageHeader
            title="Customers"
            subtitle="Manage the customer directory and attach them to orders"
            action={
              <Link
                href="/pos/orders"
                className="flex items-center gap-1 rounded-wisePill border border-wise-border bg-white px-3.5 py-2 text-sm font-medium text-wise-body transition-colors hover:border-wise-primary hover:text-wise-ink"
              >
                Orders <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wise-mute" />
              <Input className="pl-9" placeholder="Search by name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" /> Add Customer
            </Button>
          </div>

          {/* Inline add form */}
          {showForm && (
            <Card className="border-wise-primary bg-wise-primary-pale/40">
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
                  <Button onClick={() => void handleCreate()} disabled={busy || !name} className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" /> {busy ? "Saving…" : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {customers.length === 0 && !loading ? (
            <EmptyState icon={Users} title="No customers" subtitle="Add customers to attach them to orders." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paged.map((c) => (
                  <Card
                    key={c.id}
                    className="group border-wise-border transition-all duration-200 hover:-translate-y-0.5 hover:border-wise-primary"
                  >
                    <CardContent className="flex items-center gap-3 py-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wise-primary-pale font-display text-base font-extrabold text-wise-ink-deep">
                        {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-wise-ink">{c.name}</p>
                        <div className="mt-1 space-y-0.5 text-sm text-wise-body">
                          {c.email && (
                            <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0 text-wise-mute" /> <span className="truncate">{c.email}</span></p>
                          )}
                          {c.phone && (
                            <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0 text-wise-mute" /> {c.phone}</p>
                          )}
                          {!c.email && !c.phone && <p className="text-wise-mute">No contact info</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  hasNextPage={page < totalPages}
                  hasPreviousPage={page > 1}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
