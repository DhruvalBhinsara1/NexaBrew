"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, ShoppingCart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/formatCurrency";

// Icons are selected by key — components can't be passed as props from a
// Server Component to this Client Component.
const ICONS = { cart: ShoppingCart, trending: TrendingUp, bar: BarChart3 } as const;

export interface TrendPoint {
  label: string; // short axis label e.g. "Mon"
  value: number;
}

interface Props {
  title: string;
  value: string;
  sub?: string;
  icon: keyof typeof ICONS;
  href: string;
  /** hex accent used for the chart strokes/fills */
  color: string;
  chartType: "bar" | "area";
  series: TrendPoint[];
  /** how raw series values are formatted in the summary stats */
  format: "int" | "currency";
  popoverTitle: string;
  popoverHint?: string;
}

const W = 260;
const H = 84;
const PAD = 6;

function BarChart({ series, color, open }: { series: TrendPoint[]; color: string; open: boolean }) {
  const max = Math.max(...series.map((p) => p.value), 1);
  const n = series.length;
  const gap = 8;
  const bw = (W - PAD * 2 - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {series.map((p, i) => {
        const h = Math.max(2, (p.value / max) * (H - PAD * 2));
        const x = PAD + i * (bw + gap);
        const y = H - PAD - h;
        const isLast = i === n - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={bw}
            height={h}
            rx={3}
            fill={color}
            opacity={isLast ? 1 : 0.35}
            style={{
              transformOrigin: `${x + bw / 2}px ${H - PAD}px`,
              transform: open ? "scaleY(1)" : "scaleY(0)",
              transition: "transform 420ms cubic-bezier(0.22,1,0.36,1)",
              transitionDelay: open ? `${i * 45}ms` : "0ms",
            }}
          />
        );
      })}
    </svg>
  );
}

function AreaChart({ series, color, open, id }: { series: TrendPoint[]; color: string; open: boolean; id: string }) {
  const max = Math.max(...series.map((p) => p.value), 1);
  const n = series.length;
  const stepX = (W - PAD * 2) / Math.max(1, n - 1);
  const pts = series.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - (p.value / max) * (H - PAD * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${H - PAD} L${pts[0][0]},${H - PAD} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={area}
        fill={`url(#grad-${id})`}
        style={{ opacity: open ? 1 : 0, transition: "opacity 500ms ease 120ms" }}
      />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: open ? 0 : 1,
          transition: "stroke-dashoffset 700ms cubic-bezier(0.65,0,0.35,1)",
        }}
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={3.5}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        style={{ opacity: open ? 1 : 0, transition: "opacity 300ms ease 600ms" }}
      />
    </svg>
  );
}

export function KpiTrendCard({
  title,
  value,
  sub,
  icon,
  href,
  color,
  chartType,
  series,
  format,
  popoverTitle,
  popoverHint,
}: Props): React.ReactElement {
  const Icon = ICONS[icon];
  const [open, setOpen] = useState(false);
  const id = title.replace(/\s+/g, "-").toLowerCase();
  const fmt = (n: number): string => (format === "currency" ? formatCurrency(n) : String(Math.round(n)));

  const values = series.map((p) => p.value);
  const today = values[values.length - 1] ?? 0;
  const peak = Math.max(...values, 0);
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length ? total / values.length : 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link href={href} className="block">
        <Card className="border-surface-border bg-white shadow-sm transition-all duration-300 hover:border-brand-300 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">{title}</CardTitle>
            <Icon
              className="h-4 w-4 transition-transform duration-300"
              style={{ color, transform: open ? "scale(1.12)" : "scale(1)" }}
            />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-zinc-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
          </CardContent>
        </Card>
      </Link>

      {/* Hover trend popover */}
      <div
        className={cn(
          "absolute left-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))] origin-top-left",
          "transition-all duration-300 ease-out",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        )}
      >
        <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b border-surface-border bg-gradient-to-r from-surface-muted/80 to-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-800">{popoverTitle}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{popoverHint ?? "Last 7 days"}</p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold ring-1"
              style={{ color, backgroundColor: `${color}14`, borderColor: `${color}33` }}
            >
              {fmt(today)}
            </span>
          </div>

          <div className="px-3 pt-3">
            {chartType === "bar" ? (
              <BarChart series={series} color={color} open={open} />
            ) : (
              <AreaChart series={series} color={color} open={open} id={id} />
            )}
            {/* axis labels */}
            <div className="mt-1 flex justify-between px-1.5 text-[9px] font-medium uppercase text-zinc-300">
              {series.map((p, i) => (
                <span key={i}>{p.label}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-surface-border border-t border-surface-border">
            {[
              { k: "Today", v: fmt(today) },
              { k: "Peak", v: fmt(peak) },
              { k: chartType === "bar" ? "7-day total" : "7-day avg", v: fmt(chartType === "bar" ? total : avg) },
            ].map((s) => (
              <div key={s.k} className="px-2 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">{s.k}</p>
                <p className="mt-0.5 text-xs font-semibold text-zinc-700">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
