import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The one button (docs/design-system.md「按鈕」). Five uses × three sizes:
 * - `primary` — the one main action on a screen. White text only ever sits on primary-900.
 * - `secondary` — white + primary-300 border (「複製課程」「-1 週」).
 * - `ghost` — text-only (取消、清除篩選).
 * - `danger` — solid red, only inside a confirm dialog; `dangerSecondary` everywhere else.
 * - `link` — inline text link.
 * Sizes: `sm` 36 (dense desktop rows), `md` 44 (default, minimum touch target), `lg` 52 (phone CTAs).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-primary-900 text-white hover:bg-primary-700",
        secondary:
          "bg-white text-primary-900 border-[1.5px] border-primary-300 hover:bg-primary-50",
        ghost: "text-neutral-700 font-medium hover:bg-neutral-100",
        danger: "bg-danger-600 text-white hover:bg-danger-700",
        dangerSecondary:
          "bg-white text-danger-700 border-[1.5px] border-danger-200 hover:bg-danger-50",
        link: "text-primary-700 font-medium underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 rounded-lg px-3.5 text-sm",
        md: "h-11 rounded-xl px-5 text-[15px]",
        lg: "h-13 rounded-xl px-6 text-base",
        icon: "size-11 rounded-xl",
        iconSm: "size-9 rounded-lg",
      },
    },
    compoundVariants: [{ variant: "link", class: "h-auto px-0" }],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    isLoading?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {isLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
