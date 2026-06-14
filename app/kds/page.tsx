"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Coffee,
  LogOut,
  Search,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useRealtimeKitchenTickets } from "@/hooks/useRealtimeKitchenTickets";
import { createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KitchenTicketItem, KitchenTicketWithItems } from "@/types/domain.types";

interface ProductMeta {
  category_id: string | null;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES = [
  {
    key: "to_cook" as const,
    label: "To Cook",
    icon: ChefHat,
    // Badge variant for column count
    countVariant: "warning" as const,
    // Badge variant for ticket advance button
    advanceVariant: "warning" as const,
    // Left border accent on the ticket Card
    cardAccent: "border-l-4 border-l-amber-400",
    // Item row inside ticket
    itemBg: "bg-amber-50 hover:bg-amber-100 text-amber-900",
    itemDoneBg: "bg-wise-canvas-soft text-wise-mute line-through",
  },
  {
    key: "preparing" as const,
    label: "Preparing",
    icon: Sparkles,
    countVariant: "default" as const,
    advanceVariant: "default" as const,
    cardAccent: "border-l-4 border-l-wise-primary",
    itemBg: "bg-wise-primary-pale hover:bg-wise-primary/30 text-wise-ink-deep",
    itemDoneBg: "bg-wise-canvas-soft text-wise-mute line-through",
  },
  {
    key: "completed" as const,
    label: "Completed",
    icon: CheckCircle2,
    countVariant: "success" as const,
    advanceVariant: "success" as const,
    cardAccent: "border-l-4 border-l-wise-positive",
    itemBg: "bg-wise-canvas-soft text-wise-body",
    itemDoneBg: "bg-wise-canvas-soft text-wise-mute line-through",
  },
] as const;

type StageKey = (typeof STAGES)[number]["key"];
type Stage = (typeof STAGES)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(iso: string, now: number): string {
  const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function clockNow(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TicketSkeleton(): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-24 rounded-wisePill" />
        </div>
        <Skeleton className="h-3.5 w-20" />
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <Skeleton className="h-10 w-full rounded-wise" />
        <Skeleton className="h-10 w-full rounded-wise" />
      </CardContent>
    </Card>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

const TicketCard = memo(function TicketCard({
  ticket,
  stage,
  now,
  onAdvance,
  onCompleteItem,
}: {
  ticket: KitchenTicketWithItems;
  stage: Stage;
  now: number;
  onAdvance: (ticketId: string, status: string) => void;
  onCompleteItem: (ticketId: string, itemId: string) => void;
}): React.ReactElement {
  const canAdvance = ticket.status !== "completed";
  const mins = Math.floor((now - new Date(ticket.sent_at).getTime()) / 60000);
  const isUrgent = mins >= 15 && canAdvance;

  return (
    <Card
      className={cn(
        stage.cardAccent,
        isUrgent && "border-l-wise-negative ring-1 ring-wise-negative/30",
        canAdvance && "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-wiseModal"
      )}
      onClick={() => canAdvance && onAdvance(ticket.id, ticket.status)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className={cn(
              "font-display text-lg font-extrabold tracking-tight",
              isUrgent ? "text-wise-negative" : "text-wise-ink"
            )}>
              #{ticket.ticket_number}
            </CardTitle>
            <p className={cn(
              "mt-0.5 flex items-center gap-1 text-xs",
              isUrgent ? "font-semibold text-wise-negative" : "text-wise-mute"
            )}>
              <Clock className="h-3 w-3 shrink-0" />
              {elapsed(ticket.sent_at, now)}
              {isUrgent && " · Urgent!"}
            </p>
          </div>

          {canAdvance ? (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "shrink-0 text-xs font-semibold",
                isUrgent
                  ? "border-wise-negative text-wise-negative hover:bg-wise-negative hover:text-white"
                  : stage.key === "preparing"
                    ? "border-wise-primary bg-wise-primary text-wise-ink hover:bg-wise-primary-active"
                    : "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
              )}
              onClick={(e) => { e.stopPropagation(); onAdvance(ticket.id, ticket.status); }}
            >
              Advance →
            </Button>
          ) : (
            <Badge variant="success" className="shrink-0 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ul className="space-y-1.5">
          {ticket.items.map((item: KitchenTicketItem) => (
            <li
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!item.is_completed) onCompleteItem(ticket.id, item.id);
              }}
              className={cn(
                "flex cursor-pointer select-none items-center justify-between rounded-wise px-3 py-2.5 text-sm font-medium transition-colors",
                item.is_completed ? stage.itemDoneBg : stage.itemBg
              )}
            >
              <span>{item.product_name}</span>
              <Badge variant={item.is_completed ? "neutral" : "outline"} className="ml-2 shrink-0 font-bold">
                ×{item.quantity}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}, (prev, next) => {
  return (
    prev.stage.key === next.stage.key &&
    prev.now === next.now &&
    JSON.stringify(prev.ticket) === JSON.stringify(next.ticket)
  );
});

// ─── Column ───────────────────────────────────────────────────────────────────

function KdsColumn({
  stage,
  tickets,
  loading,
  now,
  onAdvance,
  onCompleteItem,
}: {
  stage: Stage;
  tickets: KitchenTicketWithItems[];
  loading: boolean;
  now: number;
  onAdvance: (id: string, status: string) => void;
  onCompleteItem: (ticketId: string, itemId: string) => void;
}): React.ReactElement {
  const Icon = stage.icon;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Column header — same style as dashboard page section headers */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold tracking-tight text-wise-ink">
          <Icon className="h-4 w-4 text-wise-mute" />
          {stage.label}
        </h2>
        <Badge variant={stage.countVariant}>{tickets.length}</Badge>
      </div>

      {/* Divider */}
      <div className="h-px bg-wise-border" />

      {/* Scrollable ticket list */}
      <div className="flex-1 space-y-3 overflow-y-auto pb-2">
        {loading ? (
          <>
            <TicketSkeleton />
            <TicketSkeleton />
          </>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-wiseCard border border-dashed border-wise-border bg-white py-16 text-center">
            <UtensilsCrossed className="h-6 w-6 text-wise-mute" />
            <p className="text-sm font-medium text-wise-mute">
              Nothing to {stage.label.toLowerCase()}
            </p>
          </div>
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              stage={stage}
              now={now}
              onAdvance={onAdvance}
              onCompleteItem={onCompleteItem}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KdsPage(): React.ReactElement {
  const router = useRouter();
  const { data: tickets, loading } = useRealtimeKitchenTickets();
  // Latest tickets snapshot for stable callbacks (avoids stale closures).
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;
  const [timeStr, setTimeStr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productMeta, setProductMeta] = useState<Map<string, ProductMeta>>(new Map());

  useEffect(() => {
    setTimeStr(clockNow());
    const id = setInterval(() => {
      setTimeStr(clockNow());
      setNow(Date.now());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    void (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, category_id, category:categories(id, name)");
      if (!data) return;
      const map = new Map<string, ProductMeta>();
      const cats = new Map<string, string>();
      for (const p of data) {
        const cat = (p as { category: { id: string; name: string } | null }).category;
        map.set(p.name, { category_id: p.category_id });
        if (cat) cats.set(cat.id, cat.name);
      }
      setProductMeta(map);
      setCategories(Array.from(cats, ([id, name]) => ({ id, name })));
    })();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) =>
      t.items.some((it) => {
        const meta = productMeta.get(it.product_name);
        const okCat = categoryId === "all" || meta?.category_id === categoryId;
        const okSearch =
          !q ||
          it.product_name.toLowerCase().includes(q) ||
          t.ticket_number.toLowerCase().includes(q);
        return okCat && okSearch;
      })
    );
  }, [tickets, search, categoryId, productMeta]);

  const byStatus: Record<StageKey, KitchenTicketWithItems[]> = {
    to_cook: visible.filter((t) => t.status === "to_cook"),
    preparing: visible.filter((t) => t.status === "preparing"),
    completed: visible.filter((t) => {
      if (t.status !== "completed") return false;
      if (!t.completed_at) return true;
      return now - new Date(t.completed_at).getTime() < 5 * 60 * 1000;
    }),
  };

  const handleAdvance = useCallback(async (ticketId: string, currentStatus: string): Promise<void> => {
    const next = currentStatus === "to_cook" ? "preparing" : "completed";
    await fetch(`/api/kitchen/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }, []);

  const handleCompleteItem = useCallback(async (ticketId: string, itemId: string): Promise<void> => {
    const ticket = ticketsRef.current.find((t) => t.id === ticketId);
    // Was this the last item still cooking? (every other item already done)
    const wasLastItem =
      !!ticket &&
      ticket.status !== "completed" &&
      ticket.items.every((it) => it.id === itemId || it.is_completed);

    await fetch(`/api/kitchen/tickets/${ticketId}/items/${itemId}`, { method: "PATCH" });

    // All items struck → move the whole ticket to the next column.
    if (wasLastItem && ticket) {
      await handleAdvance(ticketId, ticket.status);
    }
  }, [handleAdvance]);

  async function handleLogout(): Promise<void> {
    await createBrowserClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-wise-canvas-soft">

      {/* Header — identical to POS terminal */}
      <header className="flex shrink-0 items-center justify-between border-b border-wise-border bg-white px-5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-wise-primary text-wise-ink">
            <Coffee className="h-4 w-4" />
          </span>
          <span className="text-base font-bold text-wise-ink">
            NexaBrew <span className="text-wise-ink-deep">Kitchen</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wise-mute" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 w-40 pl-8 text-sm"
            />
          </div>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 rounded-wise border border-wise-border bg-wise-canvas-soft px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-wise-mute" />
            <span className="font-mono text-xs font-semibold text-wise-ink">{timeStr}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            className="gap-1 text-xs text-wise-body"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </Button>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-5">
        <div className="grid h-full grid-cols-3 gap-6">
          {STAGES.map((stage) => (
            <KdsColumn
              key={stage.key}
              stage={stage}
              tickets={byStatus[stage.key]}
              loading={loading}
              now={now}
              onAdvance={handleAdvance}
              onCompleteItem={handleCompleteItem}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-wise-border bg-white px-6 py-2 text-center text-xs text-wise-mute">
        Tap a ticket to advance · Tap an item to mark complete · Urgent after 15 min · Completed clear after 5 min
      </footer>
    </div>
  );
}
