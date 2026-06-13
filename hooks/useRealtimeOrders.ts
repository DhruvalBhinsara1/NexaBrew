"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { OrderStatus, OrderWithItems } from "@/types/domain.types";

const ORDER_SELECT =
  "*, items:order_items(*), table:tables(id, table_number), customer:customers(id, name, email), employee:users!orders_employee_id_fkey(id, name), coupon:coupons(id, code, discount_type, discount_value), promotion:promotions(id, name)";

export interface RealtimeOrdersFilters {
  sessionId?: string;
  status?: OrderStatus;
  tableId?: string;
  search?: string;
}

export interface RealtimeState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
  refetch: () => Promise<void>;
}

export function useRealtimeOrders(
  filters: RealtimeOrdersFilters = {}
): RealtimeState<OrderWithItems[]> {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [data, setData] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    let query = supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false });

    if (filters.sessionId) query = query.eq("session_id", filters.sessionId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.tableId) query = query.eq("table_id", filters.tableId);
    if (filters.search) query = query.ilike("order_number", `%${filters.search}%`);

    const { data: rows, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setData((rows ?? []) as OrderWithItems[]);
    setLastSyncedAt(new Date());
  }, [filters.search, filters.sessionId, filters.status, filters.tableId, supabase]);

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
      .channel("realtime:orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => void refetch()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, supabase]);

  return { data, loading, error, lastSyncedAt, refetch };
}
