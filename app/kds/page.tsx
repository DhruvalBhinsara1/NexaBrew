"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { useRealtimeKitchenTickets } from "@/hooks/useRealtimeKitchenTickets";
import { cn } from "@/lib/utils";
import type { KitchenTicketItem, KitchenTicketWithItems } from "@/types/domain.types";

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
  onAdvance: (id: string, current: string) => void;
  onCompleteItem: (ticketId: string, itemId: string) => void;
  borderColor: string;
}

function TicketCard({ ticket, onAdvance, onCompleteItem, borderColor }: TicketCardProps): React.ReactElement {
  const canAdvance = ticket.status !== "completed";

  return (
    <div
      className={cn(
        "rounded-xl border-l-4 bg-kds-card p-4 shadow-md cursor-pointer transition-all hover:brightness-110",
        borderColor
      )}
      onClick={() => canAdvance && onAdvance(ticket.id, ticket.status)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-white">#{ticket.ticket_number}</p>
          <div className="flex items-center gap-1 text-xs text-white/50 mt-0.5">
            <Clock className="h-3 w-3" />
            {elapsed(ticket.sent_at)}
          </div>
        </div>
        {canAdvance && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
            tap to advance →
          </span>
        )}
        {ticket.status === "completed" && (
          <CheckCircle2 className="h-5 w-5 text-kds-completed" />
        )}
      </div>

      {/* Items */}
      <ul className="space-y-1.5">
        {ticket.items.map((item: KitchenTicketItem) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all",
              item.is_completed
                ? "bg-white/5 text-white/30 line-through"
                : "bg-white/10 text-white"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!item.is_completed) onCompleteItem(ticket.id, item.id);
            }}
          >
            <span className="font-medium">{item.product_name}</span>
            <span className="ml-2 shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-bold">
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
  label: string;
  status: string;
  headerClass: string;
  borderColor: string;
  tickets: KitchenTicketWithItems[];
  onAdvance: (id: string, current: string) => void;
  onCompleteItem: (ticketId: string, itemId: string) => void;
}

function KdsColumn({
  label,
  status,
  headerClass,
  borderColor,
  tickets,
  onAdvance,
  onCompleteItem,
}: ColumnProps): React.ReactElement {
  return (
    <div className="flex flex-col rounded-2xl border border-kds-border bg-kds-bg overflow-hidden">
      {/* Column header */}
      <div className={cn("flex items-center justify-between px-4 py-3", headerClass)}>
        <h2 className="font-bold text-sm uppercase tracking-widest">{label}</h2>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
          {tickets.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-3 p-3">
        {tickets.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/30">No {status.replace("_", " ")} tickets</p>
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onAdvance={onAdvance}
              onCompleteItem={onCompleteItem}
              borderColor={borderColor}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function KdsPage(): React.ReactElement {
  const { data: tickets, loading } = useRealtimeKitchenTickets();
  const [time, setTime] = useState(liveTime());

  // Tick clock every 30s
  useEffect(() => {
    const interval = setInterval(() => setTime(liveTime()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Group by status
  const toCook = tickets.filter((t) => t.status === "to_cook");
  const preparing = tickets.filter((t) => t.status === "preparing");
  // Show completed only from the last 5 minutes
  const completed = tickets.filter((t) => {
    if (t.status !== "completed") return false;
    if (!t.completed_at) return true;
    return Date.now() - new Date(t.completed_at).getTime() < 5 * 60 * 1000;
  });

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
    await fetch(`/api/kitchen/tickets/${ticketId}/items/${itemId}`, {
      method: "PATCH",
    });
  }

  return (
    <div className="flex h-screen flex-col bg-kds-bg text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-kds-border px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-white">NexaBrew</span>
          <span className="text-xs text-white/40">Kitchen Display</span>
        </div>
        <div className="flex items-center gap-2 text-white/60">
          <Clock className="h-4 w-4" />
          <span className="font-mono text-sm">{time}</span>
        </div>
      </header>

      {/* Kanban body */}
      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-kds-tocook border-t-transparent" />
          </div>
        ) : (
          <div className="grid h-full grid-cols-3 gap-4">
            <KdsColumn
              label="To Cook"
              status="to_cook"
              headerClass="bg-kds-tocook/20 text-kds-tocook"
              borderColor="border-l-kds-tocook"
              tickets={toCook}
              onAdvance={(id, s) => void handleAdvance(id, s)}
              onCompleteItem={(tid, iid) => void handleCompleteItem(tid, iid)}
            />
            <KdsColumn
              label="Preparing"
              status="preparing"
              headerClass="bg-kds-preparing/20 text-kds-preparing"
              borderColor="border-l-kds-preparing"
              tickets={preparing}
              onAdvance={(id, s) => void handleAdvance(id, s)}
              onCompleteItem={(tid, iid) => void handleCompleteItem(tid, iid)}
            />
            <KdsColumn
              label="Completed"
              status="completed"
              headerClass="bg-kds-completed/20 text-kds-completed"
              borderColor="border-l-kds-completed"
              tickets={completed}
              onAdvance={(id, s) => void handleAdvance(id, s)}
              onCompleteItem={(tid, iid) => void handleCompleteItem(tid, iid)}
            />
          </div>
        )}
      </div>

      <footer className="border-t border-kds-border px-6 py-2 text-center text-xs text-white/20">
        Tap a ticket to advance · Tap an item to mark complete · Completed tickets clear after 5 min
      </footer>
    </div>
  );
}
