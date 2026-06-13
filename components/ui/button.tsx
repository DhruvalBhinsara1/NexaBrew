import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-wiseCard text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-wise-canvas disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Wise primary: lime-green CTA pill with ink text.
        default: "bg-wise-primary text-wise-ink hover:bg-wise-primary-active",
        destructive: "bg-wise-negative text-white hover:bg-wise-negative-deep",
        // Wise tertiary: white with ink hairline.
        outline:
          "border border-wise-ink bg-wise-canvas text-wise-ink hover:bg-wise-canvas-soft",
        // Wise secondary: sage fill.
        secondary: "bg-wise-canvas-soft text-wise-ink hover:bg-wise-border",
        ghost: "text-wise-body hover:bg-wise-canvas-soft hover:text-wise-ink",
        link: "text-wise-ink-deep underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-wise px-3 text-xs",
        lg: "h-11 px-7 text-base",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
