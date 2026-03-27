import { X } from "lucide-react"
import { useToastStore } from "../stores/toast.js"

export function ToastContainer() {
	const { toasts, removeToast } = useToastStore()

	if (toasts.length === 0) return null

	return (
		<section
			className="fixed bottom-4 right-4 z-[10200] flex flex-col gap-2"
			aria-label="Notifications"
			aria-live="polite"
		>
			{toasts.map((t) => (
				<div
					key={t.id}
					className={`flex min-w-64 max-w-sm items-start gap-3 rounded-lg border p-3 shadow-lg ${
						t.dying
							? "animate-out fade-out-0 slide-out-to-right-4 duration-200"
							: "animate-in slide-in-from-right-4 fade-in-0 duration-300"
					} ${
						t.type === "success"
							? "border-success/30 bg-surface text-success"
							: t.type === "error"
								? "border-danger/30 bg-surface text-danger"
								: "border-border bg-surface text-fg"
					}`}
					role="alert"
				>
					<span className="flex-1 text-sm">{t.message}</span>
					<button
						type="button"
						onClick={() => removeToast(t.id)}
						className="shrink-0 text-muted hover:text-fg"
						aria-label="Dismiss notification"
					>
						<X size={14} />
					</button>
				</div>
			))}
		</section>
	)
}
