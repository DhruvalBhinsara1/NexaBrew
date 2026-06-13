"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "green" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-brand-500 hover:bg-brand-600",
  green: "bg-kds-completed hover:bg-emerald-600",
  neutral: "bg-foreground hover:bg-foreground/90",
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
        "group relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-md px-6 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
