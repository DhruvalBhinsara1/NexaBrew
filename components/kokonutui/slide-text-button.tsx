"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "green" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  // Wise: lime CTA with ink text (primary), ink-pill with lime text (confirm).
  brand: "bg-wise-primary text-wise-ink hover:bg-wise-primary-active",
  green: "bg-wise-ink text-wise-primary hover:bg-wise-ink/90",
  neutral: "bg-wise-ink text-white hover:bg-wise-ink/90",
};

export interface SlideTextButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show a spinner and disable interaction. */
  loading?: boolean;
  /** Color tone — brand (default) for primary actions, green for pay/confirm. */
  tone?: Tone;
}

/**
 * Kokonutui-style primary CTA (DECISION-010). On hover the label nudges left
 * and a chevron slides in. Used for Sign In, Send to Kitchen, Process Payment.
 */
export function SlideTextButton({
  children,
  className,
  loading = false,
  tone = "brand",
  disabled,
  type = "button",
  ...props
}: SlideTextButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "group relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-wiseCard px-6 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <span className="relative inline-flex items-center gap-1.5">
          <span className="transition-transform duration-200 group-hover:-translate-x-1">
            {children}
          </span>
          <span
            aria-hidden
            className="-translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
          >
            →
          </span>
        </span>
      )}
    </button>
  );
}
