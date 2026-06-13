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

// ─── Stage config — designed for kitchen readability ─────────────────────────

const STAGES = [
  {
    key: "to_cook" as const,
    label: "To Cook",
    icon: ChefHat,
    // Column header strip
    headerBg: "bg-amber-500",
    headerText: "text-white",
    // Column body tint
    colBg: "bg-amber-50",
    // Card left border
    cardBorder: "border-l-amber-500",
    // Advance button
    btnBg: "bg-amber-500 hover:bg-amber-600",
    btnText: "text-white",
    // Item row
    itemBg: "bg-amber-100",
    itemText: "text-amber-900",
    itemHover: "hover:bg-amber-200",
    // Count badge
    countBg: "bg-white/30",
    countText: "text-white",
  },
  {
    key: "preparing" as const,
    label: "Preparing",
    icon: Sparkles,
    headerBg: "bg-wise-primary",
    headerText: "text-wise-ink",
    colBg: "bg-wise-primary-pale",
    cardBorder: "border-l-wise-primary",
    btnBg: "bg-wise-ink hover:bg-wise-ink/90",
    btnText: "text-wise-primary",
    itemBg: "bg-wise-primary/25",
    itemText: "text-wise-ink-deep",
    itemHover: "hover:bg-wise-primary/35",
    countBg: "bg-wise-ink/20",
    countText: "text-wise-ink-deep",
  },
  {
    key: "completed" as const,
    label: "Completed",
    icon: CheckCircle2,
    headerBg: "bg-wise-positive",
    headerText: "text-white",
    colBg: "bg-emerald-50",
    cardBorder: "border-l-wise-positive",
    btnBg: "",
    btnText: "",
    itemBg: "bg-wise-canvas-soft",
    itemText: "text-wise-mute",
    itemHover: "",
    countBg: "bg-white/30",
    countText: "text-white",
  },
] as const;

type StageKey = (typeof STAGES)[number]["key"];
type Stage = (typeof STAGES)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
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
    <div className="overflow-hidden rounded-2xl border border-wise-border bg-white shadow">
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="border-t border-wise-border px-4 py-4 space-y-2">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
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
  const mins = Math.floor((Date.now() - new Date(ticket.sent_at).getTime()) / 60000);
  const isUrgent = mins >= 15 && canAdvance;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border-2 bg-white shadow-md transition-all duration-150",
        // Urgent tickets get a red ring
        isUrgent ? "border-wise-negative" : cn("border-wise-border border-l-[6px]", stage.cardBorder),
        canAdvance && "cursor-pointer hover:shadow-xl hover:-translate-y-0.5"
      )}
      onClick={() => canAdvance && onAdvance()}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-wise-border">
        <div>
          {/* Big ticket number — key for kitchen readability */}
          <p className={cn(
            "font-display text-xl font-extrabold tracking-tight",
            isUrgent ? "text-wise-negative" : "text-wise-ink"
          )}>
            #{ticket.ticket_number}
          </p>
          <p className={cn(
            "mt-0.5 flex items-center gap-1 text-sm font-medium",
            isUrgent ? "text-wise-negative" : "text-wise-mute"
          )}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {elapsed(ticket.sent_at)} ago
            {isUrgent && <span className="ml-1 font-bold">— Urgent!</span>}
          </p>
        </div>

        {/* Advance button — solid and obvious */}
        {canAdvance ? (
          <button
            className={cn(
              "shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-colors",
              stage.btnBg, stage.btnText
            )}
            onClick={(e) => { e.stopPropagation(); onAdvance(); }}
          >
            Advance →
          </button>
        ) : (
          <span className="flex items-center gap-1.5 rounded-xl bg-wise-positive px-4 py-2 text-sm font-bold text-white">
            <CheckCircle2 className="h-4 w-4" />
            Done
          </span>
        )}
      </div>

      {/* Items — large enough to read at a glance */}
      <ul className="space-y-2 p-4">
        {ticket.items.map((item: KitchenTicketItem) => (
          <li
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              if (!item.is_completed) onCompleteItem(item.id);
            }}
            className={cn(
              "flex cursor-pointer select-none items-center justify-between rounded-xl px-4 py-3 transition-colors",
              item.is_completed
                ? "bg-wise-canvas-soft text-wise-mute line-through"
                : cn(stage.itemBg, stage.itemText, stage.itemHover)
            )}
          >
            <span className="text-base font-semibold">{item.product_name}</span>
            <span className={cn(
              "ml-3 shrink-0 rounded-full w-9 h-9 flex items-center justify-center text-sm font-extrabold bg-white shadow ring-1 ring-wise-border",
              item.is_completed ? "text-wise-mute" : "text-wise-ink"
            )}>
              {item.quantity}
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
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-wise-border shadow-sm">
      {/* Coloured column header — clearly differentiates each status */}
      <div className={cn("flex items-center justify-between px-5 py-3.5", stage.headerBg)}>
        <h2 className={cn("flex items-center gap-2 text-base font-extrabold tracking-tight", stage.headerText)}>
          <Icon className="h-5 w-5" />
          {stage.label}
        </h2>
        <span className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold",
          stage.countBg, stage.countText
        )}>
          {tickets.length}
        </span>
      </div>

      {/* Ticket list */}
      <div className={cn("flex-1 space-y-3 overflow-y-auto p-3", stage.colBg)}>
        {loading ? (
          <>
            <TicketSkeleton />
            <TicketSkeleton />
          </>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow">
              <UtensilsCrossed className="h-6 w-6 text-wise-mute" />
            </span>
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

  useEffect(() => {
    setTime(clockNow());
    const id = setInterval(() => setTime(clockNow()), 30_000);
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
    <div className="flex h-screen flex-col overflow-hidden bg-wise-canvas-soft">

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-wise-border bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-wise-primary text-wise-ink">
            <Coffee className="h-4 w-4" />
          </span>
          <span className="text-base font-bold text-wise-ink">
            NexaBrew <span className="text-wise-ink-deep">Kitchen</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wise-mute" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-40 rounded-xl border border-wise-border bg-wise-canvas-soft py-1.5 pl-8 pr-3 text-sm text-wise-ink placeholder:text-wise-mute focus:border-wise-primary focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-wise-border bg-wise-canvas-soft px-3 py-1.5 text-sm text-wise-ink focus:border-wise-primary focus:outline-none transition-colors"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 rounded-xl border border-wise-border bg-wise-canvas-soft px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-wise-mute" />
            <span className="font-mono text-sm font-semibold text-wise-ink">{time}</span>
          </div>

          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium text-wise-body transition-colors hover:bg-wise-canvas-soft hover:text-wise-ink"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </header>

      {/* Kanban board */}
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

      {/* Footer */}
      <footer className="shrink-0 border-t border-wise-border bg-white px-6 py-2 text-center text-xs text-wise-mute">
        Tap a ticket to advance · Tap an item to mark complete · Urgent after 15 min · Completed clear after 5 min
      </footer>
    </div>
  );
}
