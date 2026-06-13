"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users as UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiSend } from "@/lib/api-client";
import type { User } from "@/types/domain.types";

export default function UsersPage(): React.ReactElement {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const pagedUsers = users.slice((page - 1) * pageSize, page * pageSize);

  const load = useCallback(async () => {
    try {
      setUsers(await apiGet<User[]>("/api/users"));
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(): Promise<void> {
    setBusy(true);
    try {
      await apiSend("/api/users", "POST", { name, email, password, role });
      toast({ title: "Employee added" });
      setDialog(false);
      setName(""); setEmail(""); setPassword(""); setRole("employee");
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(u: User): Promise<void> {
    const archiving = !u.is_archived;
    if (archiving && !confirm(`Archive ${u.name}? They will lose access.`)) return;
    try {
      await apiSend(`/api/users/${u.id}`, "PATCH", { is_archived: archiving });
      toast({ title: archiving ? "User archived" : "User unarchived" });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Users"
        subtitle="Manage staff accounts"
        action={
          <Button onClick={() => setDialog(true)} className="bg-wise-primary hover:bg-wise-primary">
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        }
      />

      <Card className="border-wise-border">
        <CardContent className="p-0">
          {users.length === 0 && !loading ? (
            <EmptyState icon={UsersIcon} title="No users" subtitle="Add your first staff member." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wise-border text-xs uppercase tracking-wider text-wise-mute">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-center">Role</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((u) => (
                    <tr key={u.id} className={`border-b border-wise-border last:border-0 ${u.is_archived ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-medium text-wise-ink">{u.name}</td>
                      <td className="px-4 py-3 text-wise-body">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${u.is_archived ? "bg-wise-canvas-soft text-wise-mute" : "bg-green-100 text-green-700"}`}>
                          {u.is_archived ? "archived" : "active"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => void toggleArchive(u)} className={u.is_archived ? "text-green-600" : "text-red-500"}>
                          {u.is_archived ? "Unarchive" : "Archive"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        hasNextPage={page < totalPages}
        hasPreviousPage={page > 1}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "employee")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={busy || !name || !email || password.length < 6} className="bg-wise-primary hover:bg-wise-primary">
              {busy ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
