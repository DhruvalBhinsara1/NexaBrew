"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { FloorWithTables } from "@/types/domain.types";
import type { RealtimeState } from "@/hooks/useRealtimeOrders";

export function useRealtimeTables(): RealtimeState<FloorWithTables[]> {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [data, setData] = useState<FloorWithTables[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    const { data: rows, error: fetchError } = await supabase
      .from("floors")
      .select("*, tables(*)")
      .order("created_at", { ascending: true })
      .order("table_number", { referencedTable: "tables", ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setData((rows ?? []) as FloorWithTables[]);
    setLastSyncedAt(new Date());
  }, [supabase]);

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
      .channel("realtime:tables")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables" },
        () => void refetch()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, supabase]);

  return { data, loading, error, lastSyncedAt, refetch };
}
