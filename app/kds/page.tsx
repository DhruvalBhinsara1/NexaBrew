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
  name: string;
  category_id: string | null;
  category_name: string | null;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

interface Stage {
  key: "to_cook" | "preparing" | "completed";
  label: string;
  icon: React.ElementType;
  // Column header accent colours
  accentBg: string;      // pill / badge bg
  accentText: string;    // pill / badge text
  accentDot: string;     // status dot
  accentBar: string;     // top 3px bar on column
  // Card left border
  cardBorder: string;
  // Item highlight on hover
  itemHover: string;
}

const STAGES: Stage[] = [
  {
    key: "to_cook",
    label: "To Cook",
    icon: ChefHat,
    accentBg: "bg-amber-400/20",
    accentText: "text-amber-300",
    accentDot: "bg-amber-400",
    accentBar: "bg-amber-400",
    cardBorder: "border-l-amber-400",
    itemHover: "hover:bg-amber-50/60",
  },
  {
    key: "preparing",
    label: "Preparing",
    icon: Sparkles,
    accentBg: "bg-wise-primary/20",
    accentText: "text-wise-primary",
    accentDot: "bg-wise-primary",
    accentBar: "bg-wise-primary",
    cardBorder: "border-l-wise-primary",
    itemHover: "hover:bg-wise-primary-pale/60",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    accentBg: "bg-emerald-400/20",
    accentText: "text-emerald-400",
    accentDot: "bg-emerald-400",
    accentBar: "bg-emerald-400",
    cardBorder: "border-l-emerald-400",
    itemHover: "hover:bg-emerald-50/60",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function liveTime(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function TicketSkeleton(): React.ReactElement {
  return (
    <div className="rounded-2xl border border-wise-border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-16" />
      <div className="space-y-2 pt-1">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: KitchenTicketWithItems;
  stage: Stage;
  onAdvance: (id: string, current: string) => void;
  onCompleteItem: (ticketId: string, itemId: string) => void;
}

function TicketCard({ ticket, stage, onAdvance, onCompleteItem }: TicketCardProps): React.ReactElement {
  const canAdvance = ticket.status !== "completed";
  const Icon = stage.icon;

  return (
    <div
      className={cn(
        "group rounded-2xl border border-wise-border border-l-4 bg-white shadow-sm transition-all duration-200",
        stage.cardBorder,
        canAdvance && "cursor-pointer hover:shadow-wiseCard hover:-translate-y-0.5"
      )}
      onClick={() => canAdvance && onAdvance(ticket.id, ticket.status)}
    >
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div>
          <p className="font-display text-base font-extrabold text-wise-ink tracking-tight">
            #{ticket.ticket_number}
          </p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-wise-mute">
            <Clock className="h-3 w-3" />
            <span>{elapsed(ticket.sent_at)} ago</span>
          </div>
        </div>

        {canAdvance ? (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              stage.accentBg,
              stage.accentText,
              "group-hover:opacity-90"
            )}
          >
            <Icon className="h-3 w-3" />
            advance →
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Done
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-wise-border" />

      {/* Items */}
      <ul className="space-y-1.5 px-4 py-3">
        {ticket.items.map((item: KitchenTicketItem) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors cursor-pointer select-none",
              item.is_completed
                ? "bg-wise-canvas-soft/70 text-wise-mute line-through"
                : cn("bg-wise-canvas-soft text-wise-ink", stage.itemHover)
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!item.is_completed) onCompleteItem(ticket.id, item.id);
            }}
          >
            <span className="font-medium">{item.product_name}</span>
            <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-wise-body shadow-sm ring-1 ring-wise-border">
              ×{item.quantity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  stage: Stage;
  tickets: KitchenTicketWithItems[];
  loading: boolean;
  onAdvance: (id: string, current: string) => void;
  onCompleteItem: (ticketId: string, itemId: string) => void;
}

function KdsColumn({ stage, tickets, loading, onAdvance, onCompleteItem }: ColumnProps): React.ReactElement {
  const Icon = stage.icon;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-wise-border bg-wise-canvas-soft/60 shadow-sm">
      {/* Accent top bar */}
      <div className={cn("h-[3px] w-full", stage.accentBar)} />

      {/* Column header */}
      <div className="flex items-center justify-between bg-white/70 backdrop-blur px-4 py-3 border-b border-wise-border">
        <h2 className="flex items-center gap-2 text-sm font-bold text-wise-ink">
          <Icon className={cn("h-4 w-4", stage.accentText)} />
          <span className="uppercase tracking-widest text-[11px]">{stage.label}</span>
        </h2>
        <span
          className={cn(
            "flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold",
            stage.accentBg,
            stage.accentText
          )}
        >
          {tickets.length}
        </span>
      </div>

      {/* Scrollable ticket list */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {loading ? (
          <>
            <TicketSkeleton />
            <TicketSkeleton />
          </>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wise-border/50">
              <UtensilsCrossed className="h-6 w-6 text-wise-mute" />
            </div>
            <p className="text-xs text-wise-mute">No {stage.label.toLowerCase()} tickets</p>
          </div>
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              stage={stage}
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
  const [time, setTime] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productMeta, setProductMeta] = useState<Map<string, ProductMeta>>(new Map());

  // Tick clock every 30s (client-only to avoid SSR mismatch)
  useEffect(() => {
    setTime(liveTime());
    const interval = setInterval(() => setTime(liveTime()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    void supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
  }, []);

  async function handleLogout(): Promise<void> {
    await createBrowserClient().auth.signOut();
    router.replace("/login");
  }

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
        map.set(p.name, { name: p.name, category_id: p.category_id, category_name: cat?.name ?? null });
        if (cat) cats.set(cat.id, cat.name);
      }
      setProductMeta(map);
      setCategories(Array.from(cats, ([id, name]) => ({ id, name })));
    })();
  }, []);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (t: KitchenTicketWithItems): boolean => {
      const items = t.items.filter((it) => {
        const meta = productMeta.get(it.product_name);
        const okCat = categoryId === "all" || meta?.category_id === categoryId;
        const okSearch =
          !q ||
          it.product_name.toLowerCase().includes(q) ||
          t.ticket_number.toLowerCase().includes(q);
        return okCat && okSearch;
      });
      return items.length > 0;
    };
  }, [search, categoryId, productMeta]);

  const visible = tickets.filter(matches);
  const byStatus: Record<string, KitchenTicketWithItems[]> = {
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

  return (
    <div className="flex h-screen flex-col bg-wise-canvas-soft">
      {/* ── Header (dark brand bar — matches dashboard sidebar) ── */}
      <header className="flex shrink-0 items-center justify-between bg-wise-ink px-5 py-3 shadow-md">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-wise bg-wise-primary text-wise-ink shadow-sm">
            <Coffee className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-white">NexaBrew</span>
            <span className="block text-[11px] font-medium text-wise-primary/80 tracking-wide uppercase">
              Kitchen Display
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item or ticket…"
              className="w-48 rounded-lg border border-white/10 bg-white/10 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/40 focus:border-wise-primary focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-wise-primary/40 transition-colors"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-white focus:border-wise-primary focus:outline-none focus:ring-2 focus:ring-wise-primary/40 transition-colors"
          >
            <option value="all">All products</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Clock */}
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-wise-primary" />
            <span className="font-mono text-sm font-semibold text-white">{time}</span>
          </div>

          {/* Logout */}
          {loggedIn && (
            <button
              onClick={() => void handleLogout()}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          )}
        </div>
      </header>

      {/* ── Kanban board ── */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-3">
          {STAGES.map((stage) => (
            <KdsColumn
              key={stage.key}
              stage={stage}
              tickets={byStatus[stage.key]}
              loading={loading}
              onAdvance={(id, s) => void handleAdvance(id, s)}
              onCompleteItem={(tid, iid) => void handleCompleteItem(tid, iid)}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="shrink-0 border-t border-wise-border bg-white/60 backdrop-blur px-6 py-2 text-center text-[11px] text-wise-mute">
        Tap a ticket to advance&nbsp;·&nbsp;Tap an item to mark it complete&nbsp;·&nbsp;Completed tickets clear after 5 min
      </footer>
    </div>
  );
}
