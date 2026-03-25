import { MessageSquare } from "lucide-react"
import { Link } from "wouter"
import { BpmnkitLogo } from "../components/Logo.js"
import { ModeToggle } from "../components/ModeToggle.js"
import { useUiStore } from "../stores/ui.js"

export function TopBar() {
	const { aiOpen, toggleAI, toggleSidebar, breadcrumbs } = useUiStore()

	return (
		<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
			{/* Logo — click to toggle sidebar */}
			<button
				type="button"
				onClick={toggleSidebar}
				className="flex items-center gap-2 shrink-0 rounded hover:opacity-80 transition-opacity duration-150"
				aria-label="Toggle sidebar"
				title="Toggle sidebar ["
			>
				<BpmnkitLogo height={30} />
				<span className="text-sm font-semibold text-fg">Studio</span>
			</button>

			{/* Breadcrumb */}
			{breadcrumbs.length > 0 && (
				<nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
					<span className="text-border" aria-hidden="true">
						/
					</span>
					{breadcrumbs.map((crumb, i) => {
						const isLast = i === breadcrumbs.length - 1
						return (
							<span key={crumb.label} className="flex items-center gap-1.5 min-w-0">
								{crumb.href && !isLast ? (
									<Link
										href={crumb.href}
										className="text-muted hover:text-fg transition-colors duration-100 truncate"
									>
										{crumb.label}
									</Link>
								) : (
									<span className={`truncate ${isLast ? "text-fg font-medium" : "text-muted"}`}>
										{crumb.label}
									</span>
								)}
								{!isLast && (
									<span className="text-border shrink-0" aria-hidden="true">
										/
									</span>
								)}
							</span>
						)
					})}
				</nav>
			)}

			<div className="ml-auto flex items-center gap-2">
				<ModeToggle />
				<button
					type="button"
					onClick={toggleAI}
					className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${
						aiOpen
							? "border-accent bg-accent/10 text-accent"
							: "border-border text-muted hover:text-fg"
					}`}
					aria-label="Toggle AI assistant"
					aria-pressed={aiOpen}
				>
					<MessageSquare size={16} />
				</button>
			</div>
		</header>
	)
}
