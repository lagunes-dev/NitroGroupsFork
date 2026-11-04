import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Botones rectangulares de 8px, Poppins de 14px, un relleno por variante (DESIGN.md → Components).
const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] font-[family-name:var(--font-display)] font-semibold transition-[background-color,color,box-shadow] duration-300 ease-[var(--ease-out)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "bg-acento text-acento-ink hover:bg-acento-press",
                destructive: "bg-error text-acento-ink hover:brightness-95",
                outline: "bg-transparent text-tinta shadow-[inset_0_0_0_1px_var(--linea-fuerte)] hover:bg-fondo-2",
                secondary: "bg-fondo-2 text-tinta hover:bg-fondo-3",
                ghost: "text-tinta hover:bg-fondo-2",
                link: "text-tinta underline decoration-acento decoration-2 underline-offset-4 hover:text-acento px-0",
            },
            size: {
                default: "h-10 px-6 text-sm",
                sm: "h-9 px-5 text-sm",
                lg: "h-12 px-7 text-[0.9375rem]",
                icon: "h-10 w-10",
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
