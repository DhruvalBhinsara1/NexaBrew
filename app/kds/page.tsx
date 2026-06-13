"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Coffee, LogOut, Search, UtensilsCrossed } from "lucide-react";
import { useRealtimeKitchenTickets } from "@/hooks/useRealtimeKitchenTickets";
import { createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { KitchenTicketItem, KitchenTicketWithItems } from "@/types/domain.types";

interface ProductMeta {
  name: string;
  category_id: string | null;
  category_name: string | null;
}

// ─── Stage theme (light, matches the coffee/cream app theme) ──────────────────

interface Stage {
  key: "to_cook" | "preparing" | "completed";
  label: string;
  headerBar: string; // top accent bar on the column
  headerText: string;
  countBadge: string;
  cardBorder: string; // left border on ticket cards
  dot: string;
}

const STAGES: Stage[] = [
  {
    key: "to_cook",
    label: "To Cook",
    headerBar: "bg-amber-500",
    headerText: "text-amber-700",
    countBadge: "bg-amber-100 text-amber-700",
    cardBorder: "border-l-amber-500",
    dot: "bg-amber-500",
  },
  {
    key: "preparing",
    label: "Preparing",
    headerBar: "bg-blue-500",
    headerText: "text-blue-700",
    countBadge: "bg-blue-100 text-blue-700",
    cardBorder: "border-l-blue-500",
    dot: "bg-blue-500",
  },
  {
    key: "completed",
    label: "Completed",
    headerBar: "bg-emerald-500",
    headerText: "text-emerald-700",
    countBadge: "bg-emerald-100 text-emerald-700",
    cardBorder: "border-l-emerald-500",
    dot: "bg-emerald-500",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Ticket Card ────────────────────────────────────────────────────────────

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
        "rounded-xl border border-wise-border border-l-4 bg-white p-4 shadow-sm transition-all",
        stage.cardBorder,
        canAdvance && "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
      )}
      onClick={() => canAdvance && onAdvance(ticket.id, ticket.status)}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-lg font-bold text-wise-ink">#{ticket.ticket_number}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-wise-mute">
            <Clock className="h-3 w-3" />
            {elapsed(ticket.sent_at)} ago
          </div>
        </div>
        {canAdvance ? (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", stage.countBadge)}>
            tap to advance →
          </span>
        ) : (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
      </div>

      {/* Items */}
      <ul className="space-y-1.5">
        {ticket.items.map((item: KitchenTicketItem) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              item.is_completed
                ? "bg-wise-canvas-soft text-wise-mute line-through"
                : "bg-wise-canvas-soft text-wise-ink hover:bg-wise-primary-pale"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!item.is_completed) onCompleteItem(ticket.id, item.id);
            }}
          >
            <span className="font-medium">{item.product_name}</span>
            <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-wise-body shadow-sm">
              ×{item.quantity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Column ──────────────────────────────────────────────────────────────────

interface ColumnProps {
  stage: Stage;
  tickets: KitchenTicketWithItems[];
  onAdvance: (id: string, current: string) => void;
  onCompleteItem: (ticketId: string, itemId: string) => void;
}

function KdsColumn({ stage, tickets, onAdvance, onCompleteItem }: ColumnProps): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-wise-border bg-wise-canvas-soft">
      {/* Accent bar */}
      <div className={cn("h-1 w-full", stage.headerBar)} />
      {/* Column header */}
      <div className="flex items-center justify-between bg-white px-4 py-3">
        <h2 className={cn("flex items-center gap-2 text-sm font-bold uppercase tracking-wider", stage.headerText)}>
          <span className={cn("h-2 w-2 rounded-full", stage.dot)} />
          {stage.label}
        </h2>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", stage.countBadge)}>
          {tickets.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-wise-mute">
            <UtensilsCrossed className="h-8 w-8" />
            <p className="text-xs">No {stage.label.toLowerCase()} tickets</p>
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function KdsPage(): React.ReactElement {
  const router = useRouter();
  const { data: tickets, loading } = useRealtimeKitchenTickets();
  // Empty on first render (server + client match); filled after mount to avoid
  // an SSR/client locale hydration mismatch (e.g. "pm" vs "PM").
  const [time, setTime] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productMeta, setProductMeta] = useState<Map<string, ProductMeta>>(new Map());

  // Tick clock every 30s (and set immediately on mount, client-only)
  useEffect(() => {
    setTime(liveTime());
    const interval = setInterval(() => setTime(liveTime()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Detect a logged-in session so we can offer logout (kitchen accounts are
  // locked to /kds). Anonymous wall displays see no logout button.
  useEffect(() => {
    const supabase = createBrowserClient();
    void supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
  }, []);

  async function handleLogout(): Promise<void> {
    await createBrowserClient().auth.signOut();
    router.replace("/login");
  }

  // Load product → category map for filtering (anon key; products are public-read)
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

  // Apply search + category filter to a ticket's items
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

  // Group by status (filtered)
  const visible = tickets.filter(matches);
  const byStatus: Record<string, KitchenTicketWithItems[]> = {
    to_cook: visible.filter((t) => t.status === "to_cook"),
    preparing: visible.filter((t) => t.status === "preparing"),
    // Show completed only from the last 5 minutes
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
    // Realtime subscription in the hook will update the UI automatically
  }

  async function handleCompleteItem(ticketId: string, itemId: string): Promise<void> {
    await fetch(`/api/kitchen/tickets/${ticketId}/items/${itemId}`, { method: "PATCH" });
  }

  return (
    <div className="flex h-screen flex-col bg-wise-canvas-soft text-wise-ink">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-wise-border bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-wise bg-wise-primary text-wise-ink">
            <Coffee className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-bold text-wise-ink">NexaBrew</span>
            <span className="block text-[11px] text-wise-mute">Kitchen Display</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wise-mute" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item or ticket…"
              className="w-48 rounded-lg border border-wise-border bg-white py-1.5 pl-8 pr-2 text-sm text-wise-ink placeholder:text-wise-mute focus:outline-none focus:ring-2 focus:ring-wise-primary"
            />
          </div>
          {/* Category filter */}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-wise-border bg-white px-2 py-1.5 text-sm text-wise-ink focus:outline-none focus:ring-2 focus:ring-wise-primary"
          >
            <option value="all">All products</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-lg bg-wise-canvas-soft px-3 py-1.5 text-wise-body">
            <Clock className="h-4 w-4 text-wise-primary" />
            <span className="font-mono text-sm font-medium">{time}</span>
          </div>
          {loggedIn && (
            <button
              onClick={() => void handleLogout()}
              className="flex items-center gap-1.5 rounded-lg border border-wise-border px-3 py-1.5 text-sm font-medium text-wise-body transition-colors hover:bg-wise-canvas-soft hover:text-wise-ink"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Kanban body */}
      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-wise-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-3">
            {STAGES.map((stage) => (
              <KdsColumn
                key={stage.key}
                stage={stage}
                tickets={byStatus[stage.key]}
                onAdvance={(id, s) => void handleAdvance(id, s)}
                onCompleteItem={(tid, iid) => void handleCompleteItem(tid, iid)}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-wise-border bg-white px-6 py-2 text-center text-xs text-wise-mute">
        Tap a ticket to advance · Tap an item to mark it complete · Completed tickets clear after 5 min
      </footer>
    </div>
  );
}
