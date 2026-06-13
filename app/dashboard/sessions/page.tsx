"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Lock, Play } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
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
import type { SessionWithUser } from "@/types/domain.types";
import type { PaginatedResponse } from "@/types/pagination.types";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function duration(open: string, close: string | null): string {
  const end = close ? new Date(close).getTime() : Date.now();
  const mins = Math.floor((end - new Date(open).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SessionsPage(): React.ReactElement {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string | null }>>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  // The single open session — fetched independently of the table's
  // pagination/filter so the banner is the same for every user.
  const [active, setActive] = useState<SessionWithUser | null>(null);

  const loadActive = useCallback(async () => {
    try {
      const open = await apiGet<SessionWithUser[]>("/api/sessions?status=open");
      setActive(open?.[0] ?? null);
    } catch {
      // non-fatal: leave the banner as-is
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const data = await apiGet<Array<{ id: string; name: string | null }>>(
        "/api/sessions/users"
      );
      setUsers(data || []);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  const load = useCallback(async (currentPage: number = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));
      if (selectedUser) {
        params.set("opened_by", selectedUser);
      }

      const data = await apiGet<PaginatedResponse<SessionWithUser>>(
        `/api/sessions?${params.toString()}`
      );

      if (!data?.data || !data?.pagination) {
        throw new Error("Invalid response format");
      }

      setSessions(data.data);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
      setHasNextPage(data.pagination.hasNextPage);
      setHasPreviousPage(data.pagination.hasPreviousPage);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pageSize, selectedUser, toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  async function handleOpen(): Promise<void> {
    setBusy(true);
    try {
      await apiSend("/api/sessions", "POST", {
        opening_balance: Number(openingBalance) || 0,
      });
      toast({ title: "Session opened" });
      setOpenDialog(false);
      setOpeningBalance("");
      await Promise.all([load(1), loadActive()]);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(id: string): Promise<void> {
    if (!confirm("Close the current session? This finalizes the cash drawer.")) return;
    setBusy(true);
    try {
      await apiSend(`/api/sessions/${id}/close`, "POST", {});
      toast({ title: "Session closed" });
      await Promise.all([load(page), loadActive()]);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sessions"
        subtitle="Open and close cash-drawer sessions"
        action={
          !active && (
            <Button onClick={() => setOpenDialog(true)} className="bg-brand-500 hover:bg-brand-600">
              <Play className="mr-2 h-4 w-4" />
              Open Session
            </Button>
          )
        }
      />

      {/* Active session banner */}
      {loading ? (
        <Card className="border-surface-border">
          <CardContent className="flex items-center gap-2 py-6 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : (
        <Card
          className={
            active
              ? "border-l-4 border-l-green-500 border-green-200 bg-green-50"
              : "border-l-4 border-l-amber-500 border-amber-200 bg-amber-50"
          }
        >
          <CardContent className="flex items-center justify-between py-4">
            <div>
              {active ? (
                <>
                  <p className="flex items-center gap-2 font-semibold text-green-800">
                    <Clock className="h-4 w-4" /> Session open since {fmt(active.opened_at)}
                  </p>
                  <p className="mt-0.5 text-sm text-green-700">
                    Opened by {active.opened_by_user?.name ?? "unknown"} · opening balance{" "}
                    {formatCurrency(Number(active.opening_balance))} · {duration(active.opened_at, null)}
                  </p>
                </>
              ) : (
                <p className="font-semibold text-amber-800">No active session</p>
              )}
            </div>
            {active && (
              <Button
                variant="destructive"
                onClick={() => void handleClose(active.id)}
                disabled={busy}
              >
                <Lock className="mr-2 h-4 w-4" />
                Close Session
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="border-surface-border">
        <CardContent className="p-0">
          {/* Filters — always visible so you can clear the filter */}
          <div className="border-b border-surface-border px-4 py-3">
            <Label className="text-xs font-medium text-zinc-600">Filter by User</Label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              disabled={loadingUsers}
              className="mt-1.5 block w-full rounded-md border border-surface-border bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400 sm:max-w-xs"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || "Unknown"}
                </option>
              ))}
            </select>
          </div>

          {sessions.length === 0 && !loading ? (
            <EmptyState icon={Clock} title="No sessions" subtitle="No sessions match this filter." />
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-zinc-400">
                      <th className="px-4 py-3 text-left">Opened</th>
                      <th className="px-4 py-3 text-left">By</th>
                      <th className="px-4 py-3 text-left">Closed</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-right">Opening</th>
                      <th className="px-4 py-3 text-right">Closing</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-surface-border last:border-0">
                        <td className="px-4 py-3 text-zinc-700">{fmt(s.opened_at)}</td>
                        <td className="px-4 py-3 text-zinc-500">{s.opened_by_user?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-500">{fmt(s.closed_at)}</td>
                        <td className="px-4 py-3 text-zinc-500">{duration(s.opened_at, s.closed_at)}</td>
                        <td className="px-4 py-3 text-right text-zinc-700">
                          {formatCurrency(Number(s.opening_balance))}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700">
                          {s.closing_balance != null ? formatCurrency(Number(s.closing_balance)) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "open"
                                ? "bg-green-100 text-green-700"
                                : "bg-zinc-100 text-zinc-500"
                              }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-surface-border p-4">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  hasNextPage={hasNextPage}
                  hasPreviousPage={hasPreviousPage}
                  onPageChange={(newPage) => void load(newPage)}
                  pageSize={pageSize}
                  onPageSizeChange={(s) => { setPageSize(s); void load(1); }}
                  isLoading={loading}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Open dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ob">Opening cash balance (₹)</Label>
            <Input
              id="ob"
              type="number"
              min={0}
              placeholder="0.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleOpen()} disabled={busy} className="bg-brand-500 hover:bg-brand-600">
              {busy ? "Opening…" : "Open Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
