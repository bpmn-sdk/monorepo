import type { ComponentProps } from "preact"
import { forwardRef } from "preact/compat"
import { cn } from "./utils.js"

export type InputProps = ComponentProps<"input">

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
	return (
		<input
			ref={ref}
			className={cn(
				"flex h-8 w-full rounded border border-border bg-surface px-3 py-1 text-sm text-fg",
				"placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent",
				"disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	)
})
Input.displayName = "Input"
