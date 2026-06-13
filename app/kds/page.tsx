"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
    dotColor: "bg-wise-warning",
    cardBorderColor: "border-l-wise-warning",
    badge: "bg-wise-warning/20 text-wise-warning-deep",
    itemBase: "bg-amber-50 text-wise-ink",
    itemHover: "hover:bg-amber-100/80",
  },
  {
    key: "preparing" as const,
    label: "Preparing",
    icon: Sparkles,
    dotColor: "bg-wise-primary",
    cardBorderColor: "border-l-wise-primary",
    badge: "bg-wise-primary-pale text-wise-ink-deep",
    itemBase: "bg-wise-primary-pale text-wise-ink",
    itemHover: "hover:bg-wise-primary-neutral",
  },
  {
    key: "completed" as const,
    label: "Completed",
    icon: CheckCircle2,
    dotColor: "bg-wise-positive",
    cardBorderColor: "border-l-wise-positive",
    badge: "bg-wise-positive/15 text-wise-positive-deep",
    itemBase: "bg-wise-canvas-soft text-wise-body",
    itemHover: "",
  },
] as const;

type StageKey = (typeof STAGES)[number]["key"];
type Stage = (typeof STAGES)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function clockNow(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TicketSkeleton(): React.ReactElement {
  return (
    <div className="rounded-wiseCard border border-wise-border bg-white shadow-sm">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-20" />
      </div>
      <div className="border-t border-wise-border px-4 py-3 space-y-2">
        <Skeleton className="h-9 w-full rounded-wise" />
        <Skeleton className="h-9 w-full rounded-wise" />
      </div>
    </div>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  stage,
  onAdvance,
  onCompleteItem,
}: {
  ticket: KitchenTicketWithItems;
  stage: Stage;
  onAdvance: () => void;
  onCompleteItem: (itemId: string) => void;
}): React.ReactElement {
  const canAdvance = ticket.status !== "completed";
  const Icon = stage.icon;

  return (
    <div
      className={cn(
        "rounded-wiseCard border border-wise-border border-l-4 bg-white shadow-sm transition-all duration-150",
        stage.cardBorderColor,
        canAdvance && "cursor-pointer hover:shadow-wiseCard hover:-translate-y-0.5"
      )}
      onClick={() => canAdvance && onAdvance()}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3.5 pb-3 border-b border-wise-border">
        <div>
          <p className="font-display text-sm font-extrabold tracking-tight text-wise-ink">
            #{ticket.ticket_number}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-wise-mute">
            <Clock className="h-3 w-3 shrink-0" />
            {elapsed(ticket.sent_at)}
          </p>
        </div>

        {canAdvance ? (
          <span className={cn("rounded-wisePill px-2.5 py-1 text-xs font-semibold", stage.badge)}>
            <Icon className="mr-1 inline h-3 w-3" />
            Advance →
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-wisePill bg-wise-positive/15 px-2.5 py-1 text-xs font-semibold text-wise-positive-deep">
            <CheckCircle2 className="h-3 w-3" />
            Done
          </span>
        )}
      </div>

      {/* Items */}
      <ul className="space-y-1.5 p-3">
        {ticket.items.map((item: KitchenTicketItem) => (
          <li
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              if (!item.is_completed) onCompleteItem(item.id);
            }}
            className={cn(
              "flex cursor-pointer select-none items-center justify-between rounded-wise px-3 py-2.5 text-sm transition-colors",
              item.is_completed
                ? "bg-wise-canvas-soft/70 text-wise-mute line-through"
                : cn(stage.itemBase, stage.itemHover)
            )}
          >
            <span className="font-medium">{item.product_name}</span>
            <span className="ml-2 shrink-0 rounded-wisePill bg-white px-2.5 py-0.5 text-xs font-bold text-wise-body shadow-sm ring-1 ring-wise-border">
              ×{item.quantity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KdsColumn({
  stage,
  tickets,
  loading,
  onAdvance,
  onCompleteItem,
}: {
  stage: Stage;
  tickets: KitchenTicketWithItems[];
  loading: boolean;
  onAdvance: (id: string, status: string) => void;
  onCompleteItem: (ticketId: string, itemId: string) => void;
}): React.ReactElement {
  const Icon = stage.icon;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-wiseCard border border-wise-border bg-wise-canvas-soft shadow-sm">
      {/* Column header — white band, same as dashboard CardHeader */}
      <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-wise-border">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", stage.dotColor)} />
          <h2 className="font-display text-sm font-bold tracking-tight text-wise-ink">
            {stage.label}
          </h2>
        </div>
        <span className={cn("rounded-wisePill px-2.5 py-0.5 text-xs font-bold", stage.badge)}>
          {tickets.length}
        </span>
      </div>

      {/* Ticket list */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {loading ? (
          <>
            <TicketSkeleton />
            <TicketSkeleton />
          </>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-wise bg-white shadow-sm">
              <UtensilsCrossed className="h-5 w-5 text-wise-mute" />
            </span>
            <p className="text-xs font-medium text-wise-mute">
              No {stage.label.toLowerCase()} tickets
            </p>
          </div>
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              stage={stage}
              onAdvance={() => onAdvance(t.id, t.status)}
              onCompleteItem={(itemId) => onCompleteItem(t.id, itemId)}
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
  const [time, setTime] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productMeta, setProductMeta] = useState<Map<string, ProductMeta>>(new Map());

  // Live clock (client-only to avoid hydration mismatch)
  useEffect(() => {
    setTime(clockNow());
    const id = setInterval(() => setTime(clockNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Load product/category metadata for filtering
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

  // Filter tickets
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
      return Date.now() - new Date(t.completed_at).getTime() < 5 * 60 * 1000;
    }),
  };

  async function handleAdvance(ticketId: string, currentStatus: string): Promise<void> {
    const next = currentStatus === "to_cook" ? "preparing" : "completed";
    await fetch(`/api/kitchen/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function handleCompleteItem(ticketId: string, itemId: string): Promise<void> {
    await fetch(`/api/kitchen/tickets/${ticketId}/items/${itemId}`, { method: "PATCH" });
  }

  async function handleLogout(): Promise<void> {
    await createBrowserClient().auth.signOut();
    router.replace("/login");
  }

  return (
    // Same outer shell as POS terminal
    <div className="flex h-screen flex-col overflow-hidden bg-wise-canvas-soft">

      {/* ── Header — identical pattern to POS terminal ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-wise-border bg-white px-4 py-2.5 shadow-sm">
        {/* Brand — same as POS header */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-wise-primary text-wise-ink">
            <Coffee className="h-4 w-4" />
          </span>
          <span className="text-base font-bold text-wise-ink">
            NexaBrew{" "}
            <span className="text-wise-ink-deep">Kitchen</span>
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wise-mute" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item or ticket…"
              className="w-44 rounded-wise border border-wise-border bg-wise-canvas-soft py-1.5 pl-8 pr-3 text-xs text-wise-ink placeholder:text-wise-mute focus:border-wise-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-wise-primary/40 transition-colors"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-wise border border-wise-border bg-wise-canvas-soft px-3 py-1.5 text-xs text-wise-ink focus:border-wise-primary focus:outline-none focus:ring-1 focus:ring-wise-primary/40 transition-colors"
          >
            <option value="all">All products</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Live clock */}
          <div className="flex items-center gap-1.5 rounded-wise border border-wise-border bg-wise-canvas-soft px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-wise-mute" />
            <span className="font-mono text-xs font-semibold text-wise-ink">{time}</span>
          </div>

          {/* Logout — same style as POS nav links */}
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-1 rounded-wise px-2 py-1 text-xs text-wise-body transition-colors hover:text-wise-ink"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </header>

      {/* ── Kanban board ── */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="grid h-full grid-cols-3 gap-4">
          {STAGES.map((stage) => (
            <KdsColumn
              key={stage.key}
              stage={stage}
              tickets={byStatus[stage.key]}
              loading={loading}
              onAdvance={handleAdvance}
              onCompleteItem={handleCompleteItem}
            />
          ))}
        </div>
      </div>

      {/* ── Footer — same as other page footers ── */}
      <footer className="shrink-0 border-t border-wise-border bg-white px-6 py-2 text-center text-xs text-wise-mute">
        Tap a ticket card to advance its status&nbsp;·&nbsp;Tap an item to mark it complete&nbsp;·&nbsp;Completed tickets auto-clear after 5 min
      </footer>
    </div>
  );
}
