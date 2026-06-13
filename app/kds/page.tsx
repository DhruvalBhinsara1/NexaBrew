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

// ─── Stage config — uses the app's exact design tokens ───────────────────────

interface Stage {
  key: "to_cook" | "preparing" | "completed";
  label: string;
  icon: React.ElementType;
  // Header accent line (top of column)
  barClass: string;
  // Badge on column header (count pill)
  badgeBg: string;
  badgeText: string;
  // Status dot
  dotClass: string;
  // Card left border
  cardBorder: string;
  // Item row background
  itemBg: string;
}

const STAGES: Stage[] = [
  {
    key: "to_cook",
    label: "To Cook",
    icon: ChefHat,
    barClass: "bg-wise-warning",           // brand warning yellow
    badgeBg: "bg-wise-warning/15",
    badgeText: "text-wise-warning-deep",
    dotClass: "bg-wise-warning",
    cardBorder: "border-l-wise-warning",
    itemBg: "bg-amber-50 hover:bg-amber-100/70",
  },
  {
    key: "preparing",
    label: "Preparing",
    icon: ChefHat,
    barClass: "bg-wise-primary",           // brand lime-green
    badgeBg: "bg-wise-primary/15",
    badgeText: "text-wise-ink-deep",
    dotClass: "bg-wise-primary",
    cardBorder: "border-l-wise-primary",
    itemBg: "bg-wise-primary-pale hover:bg-wise-primary-neutral/60",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    barClass: "bg-wise-positive",          // brand green
    badgeBg: "bg-wise-positive/10",
    badgeText: "text-wise-positive-deep",
    dotClass: "bg-wise-positive",
    cardBorder: "border-l-wise-positive",
    itemBg: "bg-emerald-50 hover:bg-emerald-100/70",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function liveTime(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TicketSkeleton(): React.ReactElement {
  return (
    <div className="rounded-wiseCard border border-wise-border bg-white p-4 shadow-wiseCard space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20" />
      <div className="space-y-2 pt-1">
        <Skeleton className="h-9 w-full rounded-wise" />
        <Skeleton className="h-9 w-full rounded-wise" />
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

  return (
    <div
      className={cn(
        // Matches the card style used across dashboard: white, wiseCard radius, shadow
        "group rounded-wiseCard border border-wise-border border-l-4 bg-white shadow-wiseCard",
        "transition-all duration-200",
        stage.cardBorder,
        canAdvance && "cursor-pointer hover:shadow-wiseModal hover:-translate-y-0.5"
      )}
      onClick={() => canAdvance && onAdvance(ticket.id, ticket.status)}
    >
      {/* Card header — same spacing as dashboard Card headers */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-wise-border">
        <div>
          <p className="font-display text-base font-extrabold tracking-tight text-wise-ink">
            #{ticket.ticket_number}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-wise-mute">
            <Clock className="h-3 w-3" />
            <span>{elapsed(ticket.sent_at)}</span>
          </div>
        </div>

        {canAdvance ? (
          <span
            className={cn(
              "rounded-wisePill px-3 py-1 text-xs font-semibold transition-colors",
              stage.badgeBg,
              stage.badgeText
            )}
          >
            tap to advance →
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-wisePill bg-wise-positive/10 px-3 py-1 text-xs font-semibold text-wise-positive-deep">
            <CheckCircle2 className="h-3 w-3" />
            Done
          </span>
        )}
      </div>

      {/* Items list */}
      <ul className="space-y-1.5 px-4 py-3">
        {ticket.items.map((item: KitchenTicketItem) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center justify-between rounded-wise px-3 py-2.5 text-sm transition-colors cursor-pointer select-none",
              item.is_completed
                ? "bg-wise-canvas-soft text-wise-mute line-through"
                : stage.itemBg
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!item.is_completed) onCompleteItem(ticket.id, item.id);
            }}
          >
            <span className="font-medium text-wise-ink">{item.product_name}</span>
            <span className="ml-2 shrink-0 rounded-wisePill bg-white px-2.5 py-0.5 text-xs font-bold text-wise-body ring-1 ring-wise-border shadow-sm">
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
    // Column container — same card style used in dashboard grid
    <div className="flex min-h-0 flex-col overflow-hidden rounded-wiseCard border border-wise-border bg-white shadow-wiseCard">
      {/* Accent top bar — 3px, same as used on KPI cards */}
      <div className={cn("h-[3px] w-full shrink-0", stage.barClass)} />

      {/* Column header */}
      <div className="flex items-center justify-between border-b border-wise-border px-4 py-3">
        <h2 className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", `text-wise-body`)} />
          <span className="font-display text-sm font-bold tracking-tight text-wise-ink">
            {stage.label}
          </span>
        </h2>
        <span className={cn("rounded-wisePill px-2.5 py-0.5 text-xs font-bold", stage.badgeBg, stage.badgeText)}>
          {tickets.length}
        </span>
      </div>

      {/* Scrollable ticket area */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-wise-canvas-soft p-3">
        {loading ? (
          <>
            <TicketSkeleton />
            <TicketSkeleton />
          </>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-wise bg-wise-border/60">
              <UtensilsCrossed className="h-5 w-5 text-wise-mute" />
            </span>
            <p className="text-xs font-medium text-wise-mute">No {stage.label.toLowerCase()} tickets</p>
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
    // Full-height layout — same bg as dashboard pages
    <div className="flex h-screen flex-col bg-wise-canvas-soft">

      {/* ── Header — exact same dark bar as DashboardSidebar brand section ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-wise-ink px-6 py-3">
        {/* Brand — identical markup to DashboardSidebar */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-wise bg-wise-primary text-wise-ink">
            <Coffee className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <span className="block font-display text-base font-extrabold tracking-tight text-white">
              NexaBrew
            </span>
            <span className="block text-[11px] text-white/40">Kitchen Display</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item or ticket…"
              className="w-48 rounded-wise border border-white/10 bg-white/8 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/30 focus:border-wise-primary/60 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-wise-primary/40 transition-colors"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-wise border border-white/10 bg-white/8 px-3 py-1.5 text-sm text-white focus:border-wise-primary/60 focus:outline-none focus:ring-1 focus:ring-wise-primary/40 transition-colors"
          >
            <option value="all">All products</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Live clock — same pill style as dashboard session pill */}
          <div className="flex items-center gap-2 rounded-wisePill border border-white/10 bg-white/8 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-wise-primary" />
            <span className="font-mono text-sm font-semibold text-white">{time}</span>
          </div>

          {/* Logout — same style as sidebar nav links */}
          {loggedIn && (
            <button
              onClick={() => void handleLogout()}
              className="flex items-center gap-1.5 rounded-wise border border-white/10 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          )}
        </div>
      </header>

      {/* ── Kanban board ── */}
      <div className="flex-1 overflow-hidden p-5">
        <div className="grid h-full grid-cols-1 gap-5 md:grid-cols-3">
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

      {/* ── Footer — same border/bg as page separators used in dashboard ── */}
      <footer className="shrink-0 border-t border-wise-border bg-white px-6 py-2.5 text-center text-xs text-wise-mute">
        Tap a ticket to advance&nbsp;·&nbsp;Tap an item to mark it complete&nbsp;·&nbsp;Completed tickets clear after 5 min
      </footer>
    </div>
  );
}
