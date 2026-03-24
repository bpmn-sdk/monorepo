import { Slot } from "@radix-ui/react-slot"
import { type VariantProps, cva } from "class-variance-authority"
import type { ComponentProps } from "preact"
import { forwardRef } from "preact/compat"
import { cn } from "./utils.js"

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
	{
		variants: {
			variant: {
				default: "bg-accent text-accent-fg hover:opacity-90",
				ghost: "hover:bg-surface-2 text-fg",
				outline: "border border-border bg-transparent text-fg hover:bg-surface-2",
				danger: "bg-danger text-white hover:opacity-90",
			},
			size: {
				sm: "h-7 px-2.5 text-xs",
				md: "h-8 px-3",
				lg: "h-10 px-4",
				icon: "h-8 w-8 p-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "md",
		},
	},
)

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button"
		return (
			<Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
		)
	},
)
Button.displayName = "Button"

export { buttonVariants }
