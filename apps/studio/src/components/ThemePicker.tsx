import { useThemeStore } from "../stores/theme.js"

type Theme = "light" | "dark" | "neon"

const THEMES: { value: Theme; icon: string; label: string }[] = [
	{ value: "light", icon: "☀", label: "Light theme" },
	{ value: "dark", icon: "☾", label: "Dark theme" },
	{ value: "neon", icon: "✦", label: "Neon theme" },
]

export function ThemePicker() {
	const { theme, setTheme } = useThemeStore()

	return (
		<div className="flex rounded-md border border-border bg-surface-2 p-0.5">
			{THEMES.map((t) => (
				<button
					key={t.value}
					type="button"
					onClick={() => setTheme(t.value)}
					className={`rounded px-2 py-0.5 text-sm transition-colors ${
						theme === t.value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
					}`}
					aria-pressed={theme === t.value}
					aria-label={t.label}
				>
					{t.icon}
				</button>
			))}
		</div>
	)
}
