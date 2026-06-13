"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { KitchenTicketStatus, KitchenTicketWithItems } from "@/types/domain.types";
import type { RealtimeState } from "@/hooks/useRealtimeOrders";

export interface RealtimeKitchenTicketFilters {
  status?: KitchenTicketStatus;
  orderId?: string;
}

export function useRealtimeKitchenTickets(
  filters: RealtimeKitchenTicketFilters = {}
): RealtimeState<KitchenTicketWithItems[]> {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [data, setData] = useState<KitchenTicketWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    let query = supabase
      .from("kitchen_tickets")
      .select("*, items:kitchen_ticket_items(*)")
      .order("sent_at", { ascending: true });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.orderId) query = query.eq("order_id", filters.orderId);

    const { data: rows, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setData((rows ?? []) as KitchenTicketWithItems[]);
    setLastSyncedAt(new Date());
  }, [filters.orderId, filters.status, supabase]);

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      setLoading(true);
      await refetch();
      if (active) setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [refetch]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime:kitchen")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kitchen_tickets" },
        () => void refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kitchen_ticket_items" },
        () => void refetch()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, supabase]);

  return { data, loading, error, lastSyncedAt, refetch };
}
