"use client";

import { useEffect, useState } from "react";
import { Plus, Search, User, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/store/usePosStore";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
import type { Customer } from "@/types/domain.types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CustomerDialog({ open, onClose }: Props): React.ReactElement {
  const { toast } = useToast();
  const customerId = usePosStore((s) => s.customerId);
  const setCustomer = usePosStore((s) => s.setCustomer);

  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const url = search ? `/api/customers?search=${encodeURIComponent(search)}` : "/api/customers";
      apiGet<Customer[]>(url).then(setCustomers).catch(() => null);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open]);

  function pick(c: Customer): void {
    setCustomer(c.id, c.name);
    toast({ title: `Customer: ${c.name}` });
    onClose();
  }

  async function createAndPick(): Promise<void> {
    setBusy(true);
    try {
      const c = await apiSend<Customer>("/api/customers", "POST", {
        name: newName,
        email: newEmail || undefined,
      });
      pick(c);
      setAdding(false);
      setNewName("");
      setNewEmail("");
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-wise-ink-deep" /> Assign Customer
          </DialogTitle>
        </DialogHeader>

        {!adding ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wise-mute" />
              <Input className="pl-9" placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto">
              {customers.length === 0 ? (
                <p className="py-6 text-center text-sm text-wise-mute">No customers found.</p>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pick(c)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors hover:bg-wise-primary-pale ${
                      c.id === customerId ? "border-wise-primary bg-wise-primary-pale" : "border-wise-border"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-wise-ink">{c.name}</span>
                      <span className="block text-xs text-wise-mute">{c.email ?? c.phone ?? "—"}</span>
                    </span>
                    {c.id === customerId && <span className="text-xs font-medium text-wise-ink-deep">selected</span>}
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-wise-border pt-3">
              {customerId && (
                <Button variant="ghost" size="sm" className="text-wise-body" onClick={() => { setCustomer(null, null); onClose(); }}>
                  Clear customer
                </Button>
              )}
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => setAdding(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> New customer
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <Input type="email" placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAdding(false)}>Back</Button>
              <Button className="flex-1 bg-wise-primary hover:bg-wise-primary" onClick={() => void createAndPick()} disabled={busy || !newName}>
                <UserPlus className="mr-1 h-4 w-4" /> {busy ? "Saving…" : "Add & select"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
