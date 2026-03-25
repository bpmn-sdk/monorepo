import { DecisionsStore, createDecisionDetailView } from "@bpmnkit/operate"
import { useEffect, useRef } from "preact/hooks"
import { useLocation, useParams } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import { useThemeStore } from "../stores/theme.js"
import { useUiStore } from "../stores/ui.js"

type OperateView = ReturnType<typeof createDecisionDetailView>

export function DecisionDetail() {
	const { key } = useParams<{ key: string }>()
	const containerRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<OperateView | null>(null)
	const storeRef = useRef<DecisionsStore | null>(null)
	const { theme } = useThemeStore()
	const [, setLocation] = useLocation()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Decisions", href: "/decisions" }, { label: key }])
	}, [key, setBreadcrumbs])

	// biome-ignore lint/correctness/useExhaustiveDependencies: view is created once per key; refs are stable
	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const proxyUrl = getProxyUrl()
		const profile = getActiveProfile()

		const store = new DecisionsStore()
		storeRef.current = store
		store.connect(proxyUrl, profile, 5000, false)

		const view = createDecisionDetailView(
			key,
			store,
			{
				proxyUrl,
				profile,
				mock: false,
				theme: useThemeStore.getState().theme,
				navigate: (path: string) => setLocation(path),
			},
			() => setLocation("/decisions"),
		)

		container.appendChild(view.el)
		viewRef.current = view

		return () => {
			view.destroy()
			store.destroy()
			viewRef.current = null
			storeRef.current = null
		}
	}, [key])

	useEffect(() => {
		viewRef.current?.setTheme(theme)
	}, [theme])

	return <div ref={containerRef} className="h-full" />
}
