import * as TabsPrimitive from "@radix-ui/react-tabs"
import type { ComponentPropsWithoutRef } from "preact/compat"
import { forwardRef } from "preact/compat"
import { cn } from "./utils.js"

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn(
			"inline-flex h-9 items-center gap-1 rounded-md bg-surface-2 p-1 text-muted",
			className,
		)}
		{...props}
	/>
))
TabsList.displayName = "TabsList"

export const TabsTrigger = forwardRef<
	HTMLButtonElement,
	ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref as unknown as React.RefObject<HTMLButtonElement>}
		className={cn(
			"inline-flex items-center justify-center rounded px-3 py-1 text-sm font-medium transition-colors",
			"focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
			"data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm",
			className,
		)}
		{...props}
	/>
))
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = forwardRef<
	HTMLDivElement,
	ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		ref={ref as unknown as React.RefObject<HTMLDivElement>}
		className={cn("mt-2 focus-visible:outline-2 focus-visible:outline-accent", className)}
		{...props}
	/>
))
TabsContent.displayName = "TabsContent"
