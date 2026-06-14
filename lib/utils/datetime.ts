/**
 * Timezone-safe date/time helpers.
 *
 * NexaBrew is a single-region (India) cafe POS, so ALL dates and times — both
 * for display and for grouping/range math — are anchored to IST (Asia/Kolkata,
 * a fixed UTC+5:30, no DST). This keeps server-rendered output (Vercel runs in
 * UTC) consistent with client-rendered output (the browser's local tz) and
 * ensures "today", daily report buckets, and on-screen timestamps all agree.
 *
 * Postgres `created_at` is `timestamptz` (stored as UTC); we convert IST
 * calendar dates to the correct UTC instants when querying.
 */

export const IST_TZ = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

/** Calendar date (YYYY-MM-DD) of an instant, in IST. `en-CA` yields ISO order. */
export function istDateKey(d: Date | string | number = new Date()): string {
  const date = typeof d === "object" ? d : new Date(d);
  return date.toLocaleDateString("en-CA", { timeZone: IST_TZ });
}

/** Today's IST calendar date as YYYY-MM-DD. */
export function istToday(): string {
  return istDateKey(new Date());
}

/** Time only, in IST — e.g. "04:15 am". */
export function formatTimeIST(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST_TZ,
  });
}

/** Date + time, in IST — e.g. "14 Jun, 04:15 am". */
export function formatDateTimeIST(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST_TZ,
  });
}

/**
 * Convert an inclusive IST calendar-date range to UTC ISO instants suitable for
 * comparing against `timestamptz` columns. `from` starts at IST 00:00:00,
 * `to` ends at IST 23:59:59.999.
 */
export function istRangeToUtc(from: string, to: string): { from: string; to: string } {
  return {
    from: new Date(`${from}T00:00:00.000${IST_OFFSET}`).toISOString(),
    to: new Date(`${to}T23:59:59.999${IST_OFFSET}`).toISOString(),
  };
}

/** Add `days` (may be negative) to an IST date string, returning a YYYY-MM-DD IST date. */
export function addIstDays(dateKey: string, days: number): string {
  // Anchor at noon IST so ±day arithmetic never crosses a boundary spuriously.
  const anchor = new Date(`${dateKey}T12:00:00.000${IST_OFFSET}`);
  return istDateKey(new Date(anchor.getTime() + days * 86_400_000));
}

/** The last `n` IST calendar dates ending today, oldest first. */
export function lastNIstDates(n: number): string[] {
  const today = istToday();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addIstDays(today, -i));
  return out;
}
