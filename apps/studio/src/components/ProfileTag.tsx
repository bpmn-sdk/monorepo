/** Coloured badge for a profile tag. Predefined: dev / stage / prod. */
export function ProfileTag({ tag }: { tag: string }) {
	const cls =
		tag === "prod"
			? "bg-danger/15 text-danger"
			: tag === "stage"
				? "bg-warn/15 text-warn"
				: tag === "dev"
					? "bg-success/15 text-success"
					: "bg-surface-2 text-muted"
	return (
		<span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${cls}`}>
			{tag}
		</span>
	)
}
