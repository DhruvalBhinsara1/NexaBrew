import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-wisePill border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Wise badge — green-pale pill with deep-forest text.
        default: "border-transparent bg-wise-primary-pale text-wise-ink-deep",
        secondary: "border-transparent bg-wise-canvas-soft text-wise-body",
        destructive: "border-transparent bg-red-50 text-wise-negative-deep",
        outline: "border-wise-border text-wise-ink",
        success: "border-transparent bg-wise-primary-pale text-wise-positive-deep",
        warning: "border-transparent bg-amber-50 text-wise-warning-content",
        neutral: "border-transparent bg-wise-canvas-soft text-wise-mute",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
