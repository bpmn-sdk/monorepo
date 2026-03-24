import { type VariantProps, cva } from "class-variance-authority"
import type { JSX } from "preact"
import { cn } from "./utils.js"

const badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", {
	variants: {
		variant: {
			default: "bg-surface-2 text-fg",
			success: "bg-success/20 text-success",
			warn: "bg-warn/20 text-warn",
			danger: "bg-danger/20 text-danger",
			muted: "bg-surface-2 text-muted",
		},
	},
	defaultVariants: {
		variant: "default",
	},
})

export interface BadgeProps
	extends JSX.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
