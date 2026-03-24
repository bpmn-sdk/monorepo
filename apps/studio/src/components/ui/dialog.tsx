import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { ComponentPropsWithoutRef } from "preact/compat"
import { forwardRef } from "preact/compat"
import { cn } from "./utils.js"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn(
			"fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
			className,
		)}
		{...props}
	/>
))
DialogOverlay.displayName = "DialogOverlay"

export const DialogContent = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
	<DialogPortal>
		<DialogOverlay />
		<DialogPrimitive.Content
			ref={ref as unknown as React.RefObject<HTMLDivElement>}
			className={cn(
				"fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
				"rounded-lg border border-border bg-surface p-6 shadow-lg",
				"data-[state=open]:animate-in data-[state=closed]:animate-out",
				"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
				"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
				className,
			)}
			{...props}
		>
			{children}
			<DialogClose className="absolute right-4 top-4 rounded p-1 text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
				<X size={16} />
				<span className="sr-only">Close</span>
			</DialogClose>
		</DialogPrimitive.Content>
	</DialogPortal>
))
DialogContent.displayName = "DialogContent"

export function DialogHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return <div className={cn("flex flex-col gap-1.5", className)} {...props} />
}

export function DialogTitle({
	className,
	...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			className={cn("text-base font-semibold text-fg", className)}
			{...props}
		/>
	)
}

export function DialogDescription({
	className,
	...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
	return <DialogPrimitive.Description className={cn("text-sm text-muted", className)} {...props} />
}
