import type { CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnEditor, createSideDock, initEditorHud } from "@bpmnkit/editor"
import type { SideDock } from "@bpmnkit/editor"
import type { CommandPalettePlugin } from "@bpmnkit/plugins/command-palette"
import { createCommandPaletteEditorPlugin } from "@bpmnkit/plugins/command-palette-editor"
import { createConfigPanelPlugin } from "@bpmnkit/plugins/config-panel"
import { createConfigPanelBpmnPlugin } from "@bpmnkit/plugins/config-panel-bpmn"
import { createConnectorCatalogPlugin } from "@bpmnkit/plugins/connector-catalog"
import { QueryClientProvider } from "@tanstack/react-query"
import { BookOpen, ExternalLink, Link2, Rocket, Save } from "lucide-react"
import { render } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import { Link, useParams } from "wouter"
import { useDefinitions, useDeployProcess } from "../api/queries.js"
import { queryClient } from "../api/queryClient.js"
import { Button } from "../components/ui/button.js"
import { Input } from "../components/ui/input.js"
import type { ModelFile } from "../storage/types.js"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

// TopBar = h-12 (48px), save bar = h-10 (40px)
const DOCK_TOP = 88

// ── Deploy pane component (rendered into dock's deploy pane) ─────────────────

function StudioDeployPane({ modelId, getXml }: { modelId: string; getXml: () => string | null }) {
	const { models, saveModel, upsertModel } = useModelsStore()
	const model = models.find((m) => m.id === modelId)
	const [processIdInput, setProcessIdInput] = useState(model?.processDefinitionId ?? "")
	const { data, refetch } = useDefinitions(
		model?.processDefinitionId ? { bpmnProcessId: model.processDefinitionId } : undefined,
	)
	const deploy = useDeployProcess()

	async function handleLink() {
		if (!model) return
		const updated = await saveModel({ ...model, processDefinitionId: processIdInput || undefined })
		upsertModel(updated)
		toast.success("Process ID linked")
	}

	async function handleDeploy() {
		const xml = getXml()
		if (!xml || !model) return
		try {
			await deploy.mutateAsync({ xml, fileName: `${model.name}.bpmn` })
			await refetch()
			toast.success("Deployed successfully")
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
		}
	}

	return (
		<div className="p-4 flex flex-col gap-5 overflow-y-auto h-full">
			<div>
				<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
					<Rocket size={11} />
					Deploy
				</p>
				<Button
					size="sm"
					onClick={() => void handleDeploy()}
					disabled={deploy.isPending}
					className="w-full"
				>
					{deploy.isPending ? "Deploying…" : "Deploy to Camunda"}
				</Button>
			</div>

			<div>
				<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
					<Link2 size={11} />
					Link to Process ID
				</p>
				<div className="flex gap-1">
					<Input
						value={processIdInput}
						onInput={(e) => setProcessIdInput((e.target as HTMLInputElement).value)}
						placeholder="process-id"
						className="text-xs h-7"
						aria-label="Process definition ID"
					/>
					<Button size="sm" variant="outline" onClick={() => void handleLink()}>
						Link
					</Button>
				</div>
			</div>

			{model?.processDefinitionId && (
				<div>
					<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
						Deployed Versions
					</p>
					{!data?.items.length ? (
						<p className="text-xs text-muted">No deployed versions found.</p>
					) : (
						<ul className="divide-y divide-border rounded border border-border">
							{data.items.map((def) => (
								<li key={def.processDefinitionKey} className="hover:bg-surface-2 transition-colors">
									<Link
										href={`/definitions/${def.processDefinitionKey}`}
										className="flex items-center justify-between p-2 text-sm"
									>
										<span className="text-fg">v{def.version}</span>
										<span className="text-xs text-muted">
											{def.deploymentTime ? new Date(def.deploymentTime).toLocaleDateString() : ""}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	)
}

// ── Docs pane component ───────────────────────────────────────────────────────

interface ElementDoc {
	label: string
	href: string
	description: string
	links?: Array<{ label: string; href: string }>
}

const ELEMENT_DOCS: Record<string, ElementDoc> = {
	startEvent: {
		label: "Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/start-events/",
		description: "Marks where a process begins. The none start event is the default type.",
	},
	messageStartEvent: {
		label: "Message Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/message-events/",
		description: "Starts the process when a named message is received.",
	},
	timerStartEvent: {
		label: "Timer Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/timer-events/",
		description: "Starts the process at a specific time or on a repeating schedule.",
		links: [
			{
				label: "Timer expressions (ISO 8601)",
				href: "https://docs.camunda.io/docs/components/modeler/bpmn/timer-events/#timer-definition",
			},
		],
	},
	conditionalStartEvent: {
		label: "Conditional Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/start-events/",
		description: "Starts when a FEEL condition evaluates to true.",
	},
	signalStartEvent: {
		label: "Signal Start Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/signal-events/",
		description: "Starts when a named signal is broadcast.",
	},
	endEvent: {
		label: "End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/end-events/",
		description: "Marks where a process path ends. The token is consumed.",
	},
	messageEndEvent: {
		label: "Message End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/message-events/",
		description: "Sends a message when the path ends.",
	},
	escalationEndEvent: {
		label: "Escalation End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/escalation-events/",
		description: "Triggers an escalation in the parent scope when the path ends.",
	},
	errorEndEvent: {
		label: "Error End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/error-events/",
		description:
			"Throws a named BPMN error, propagating up to a boundary error event or error subprocess.",
	},
	terminateEndEvent: {
		label: "Terminate End Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/terminate-events/",
		description: "Ends the entire process instance immediately, cancelling all active tokens.",
	},
	task: {
		label: "Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/tasks/",
		description:
			"A generic task with no specific behavior. Use a typed task for production workflows.",
	},
	serviceTask: {
		label: "Service Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/service-tasks/",
		description:
			"Invokes an external job worker. Configure the job type, retries, and input/output mappings.",
		links: [
			{
				label: "Job Workers",
				href: "https://docs.camunda.io/docs/components/concepts/job-workers/",
			},
			{
				label: "Headers & variables",
				href: "https://docs.camunda.io/docs/components/modeler/bpmn/service-tasks/#task-headers",
			},
		],
	},
	userTask: {
		label: "User Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/user-tasks/",
		description: "Requires a human to complete a form or take action before the process continues.",
		links: [{ label: "Forms", href: "https://docs.camunda.io/docs/components/modeler/forms/" }],
	},
	scriptTask: {
		label: "Script Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/script-tasks/",
		description: "Executes a FEEL expression or script inline, without an external worker.",
	},
	sendTask: {
		label: "Send Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/send-tasks/",
		description: "Sends a message. Behaves like a service task — implement via a job worker.",
	},
	receiveTask: {
		label: "Receive Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/receive-tasks/",
		description: "Waits until a correlated message is received before continuing.",
	},
	businessRuleTask: {
		label: "Business Rule Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/business-rule-tasks/",
		description: "Evaluates a DMN decision table and maps the result to process variables.",
	},
	manualTask: {
		label: "Manual Task",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/manual-tasks/",
		description: "Represents work done outside the engine (e.g. a phone call). No automation.",
	},
	callActivity: {
		label: "Call Activity",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/call-activities/",
		description:
			"Calls a reusable child process by its process ID. Supports input/output variable mappings.",
	},
	subProcess: {
		label: "Sub-Process",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/embedded-subprocesses/",
		description: "An embedded group of tasks that share scope and can have boundary events.",
		links: [
			{
				label: "Multi-instance",
				href: "https://docs.camunda.io/docs/components/modeler/bpmn/multi-instance/",
			},
		],
	},
	adHocSubProcess: {
		label: "Ad-hoc Sub-Process",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/ad-hoc-subprocesses/",
		description:
			"A sub-process where contained activities can be executed in any order or in parallel.",
	},
	transaction: {
		label: "Transaction",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/transactions/",
		description: "A sub-process with ACID-like semantics. Can be cancelled via a cancel end event.",
	},
	exclusiveGateway: {
		label: "Exclusive Gateway (XOR)",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/exclusive-gateways/",
		description: "Routes to exactly one outgoing path based on FEEL conditions evaluated in order.",
		links: [
			{
				label: "Conditions (FEEL)",
				href: "https://docs.camunda.io/docs/components/modeler/feel/what-is-feel/",
			},
		],
	},
	parallelGateway: {
		label: "Parallel Gateway (AND)",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/parallel-gateways/",
		description:
			"Splits into all outgoing paths simultaneously, or joins by waiting for all incoming tokens.",
	},
	inclusiveGateway: {
		label: "Inclusive Gateway (OR)",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/inclusive-gateways/",
		description:
			"Activates one or more outgoing paths whose conditions are true. The join waits for all active branches.",
	},
	eventBasedGateway: {
		label: "Event-Based Gateway",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/event-based-gateways/",
		description: "Routes based on whichever following catch event occurs first.",
	},
	complexGateway: {
		label: "Complex Gateway",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/",
		description: "Custom split/join logic via a FEEL activation condition.",
	},
	messageCatchEvent: {
		label: "Message Intermediate Catch Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/message-events/",
		description: "Pauses the process until a correlated message arrives.",
		links: [
			{
				label: "Message correlation",
				href: "https://docs.camunda.io/docs/components/concepts/messages/",
			},
		],
	},
	timerCatchEvent: {
		label: "Timer Intermediate Catch Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/timer-events/",
		description: "Pauses the process for a duration or until a specific date/time.",
	},
	signalCatchEvent: {
		label: "Signal Intermediate Catch Event",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/signal-events/",
		description: "Waits for a named signal broadcast before continuing.",
	},
	sequenceFlow: {
		label: "Sequence Flow",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/",
		description:
			"Connects flow elements. Add a FEEL condition expression to make it a conditional flow.",
	},
	textAnnotation: {
		label: "Text Annotation",
		href: "https://docs.camunda.io/docs/components/modeler/bpmn/",
		description: "A non-executing comment attached to an element for documentation purposes.",
	},
}

const BPMN_REFERENCE = [
	{
		section: "Tasks",
		items: [
			"serviceTask",
			"userTask",
			"scriptTask",
			"businessRuleTask",
			"callActivity",
			"subProcess",
		],
	},
	{
		section: "Events",
		items: ["startEvent", "endEvent", "messageCatchEvent", "timerCatchEvent"],
	},
	{
		section: "Gateways",
		items: ["exclusiveGateway", "parallelGateway", "inclusiveGateway", "eventBasedGateway"],
	},
]

function DocLink({ href, label }: { href: string; label: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="flex items-center justify-between text-xs text-fg hover:text-accent py-1 px-2 rounded hover:bg-surface-2 transition-colors"
		>
			{label}
			<ExternalLink size={10} className="text-muted shrink-0" />
		</a>
	)
}

function StudioDocsPane({ elementType }: { elementType: string | null }) {
	const doc = elementType ? (ELEMENT_DOCS[elementType] ?? null) : null

	if (doc) {
		return (
			<div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
				<div>
					<p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
						{doc.label}
					</p>
					<p className="text-xs text-fg leading-relaxed">{doc.description}</p>
				</div>
				<div className="flex flex-col gap-0.5">
					<DocLink href={doc.href} label="Camunda Docs ↗" />
					{doc.links?.map((l) => (
						<DocLink key={l.href} href={l.href} label={l.label} />
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
			<div className="flex items-center gap-1.5">
				<BookOpen size={13} className="text-muted" />
				<p className="text-xs font-semibold text-muted uppercase tracking-wider">BPMN Reference</p>
			</div>
			<p className="text-xs text-muted">Select an element to see its documentation.</p>
			{BPMN_REFERENCE.map((group) => (
				<div key={group.section}>
					<p className="text-xs font-semibold text-muted mb-1">{group.section}</p>
					<ul className="flex flex-col gap-0.5">
						{group.items.map((type) => {
							const d = ELEMENT_DOCS[type]
							if (!d) return null
							return (
								<li key={type}>
									<DocLink href={d.href} label={d.label} />
								</li>
							)
						})}
					</ul>
				</div>
			))}
		</div>
	)
}

// ── ModelDetail ───────────────────────────────────────────────────────────────

export function ModelDetail() {
	const { id } = useParams<{ id: string }>()
	const { models, saveModel, upsertModel, loaded } = useModelsStore()
	const model = models.find((m) => m.id === id)
	const editorContainerRef = useRef<HTMLDivElement>(null)
	const editorRef = useRef<BpmnEditor | null>(null)
	const dockRef = useRef<SideDock | null>(null)
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
	const { theme } = useThemeStore()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Models", href: "/models" }, { label: model?.name ?? id }])
	}, [id, model?.name, setBreadcrumbs])

	// Initialize editor + dock
	// biome-ignore lint/correctness/useExhaustiveDependencies: editor created once per id+loaded; refs/closures handle the rest
	useEffect(() => {
		if (!loaded) return
		const container = editorContainerRef.current
		if (!container || !model) return

		// ── Dock ──────────────────────────────────────────────────────────────
		const dock = createSideDock()
		dock.el.style.top = `${DOCK_TOP}px`
		document.body.appendChild(dock.el)
		dockRef.current = dock

		// History requires file-storage context — not available in Studio
		dock.setVisible(true)
		dock.setHistoryTabEnabled(false)
		// Play mode not integrated in Studio
		dock.setPlayTabVisible(false)

		// Render Studio-specific content into dock panes
		render(
			<QueryClientProvider client={queryClient}>
				<StudioDeployPane
					modelId={model.id}
					getXml={() => editorRef.current?.exportXml() ?? null}
				/>
			</QueryClientProvider>,
			dock.deployPane,
		)
		function renderDocs(elementType: string | null) {
			render(<StudioDocsPane elementType={elementType} />, dock.docsPane)
		}
		renderDocs(null)
		dock.setDeployTabClickHandler(() => {
			if (dock.collapsed) dock.expand()
		})
		dock.setDocsTabClickHandler(() => {
			if (dock.collapsed) dock.expand()
		})

		// ── Command palette bridge ────────────────────────────────────────────
		// Routes editor plugin commands into the Studio global command palette.
		const bridgePalette: CommandPalettePlugin = {
			name: "studio-palette-bridge",
			install() {},
			addCommands(cmds) {
				const items = cmds.map((cmd) => ({
					id: cmd.id,
					label: cmd.title,
					description: cmd.description,
					group: "Editor",
					action: cmd.action,
				}))
				return useUiStore.getState().addContextCommands(items)
			},
			pushView(cmds, opts) {
				useUiStore.getState().pushPaletteView({
					items: cmds.map((cmd) => ({
						id: cmd.id,
						label: cmd.title,
						description: cmd.description,
						group: "",
						action: cmd.action,
					})),
					placeholder: opts?.placeholder,
					onConfirm: opts?.onConfirm,
				})
			},
		}

		// Extra editor context commands not covered by the editor plugin
		const deregisterExtra = useUiStore.getState().addContextCommands([
			{
				id: "editor:export-bpmn",
				label: "Export as BPMN XML",
				description: "Download diagram file",
				group: "Editor",
				action() {
					const xml = editorRef.current?.exportXml()
					if (!xml) return
					const blob = new Blob([xml], { type: "application/xml" })
					const url = URL.createObjectURL(blob)
					const a = document.createElement("a")
					a.href = url
					a.download = `${model?.name ?? "diagram"}.bpmn`
					a.click()
					URL.revokeObjectURL(url)
				},
			},
			{
				id: "editor:auto-layout",
				label: "Auto Layout",
				description: "Arrange elements automatically",
				group: "Editor",
				action() {
					editorRef.current?.autoLayout()
				},
			},
			{
				id: "editor:zoom-fit",
				label: "Zoom to Fit",
				description: "Fit entire diagram in view",
				group: "Editor",
				action() {
					editorRef.current?.fitView()
				},
			},
		])

		// ── Plugins ───────────────────────────────────────────────────────────
		const configPanel = createConfigPanelPlugin({
			getDefinitions: () => editorRef.current?.getDefinitions() ?? null,
			applyChange: (fn) => {
				editorRef.current?.applyChange(fn)
			},
			container: dock.propertiesPane,
			onPanelShow: () => {
				if (dock.collapsed) dock.expand()
				dock.showPanel()
			},
			onPanelHide: () => dock.hidePanel(),
		})
		const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel)

		// Bridge: wire element:click → editor:select so the config panel activates on element click
		const bridgePlugin: CanvasPlugin = {
			name: "studio-config-bridge",
			install(api) {
				type AnyEmit = (event: string, ...args: unknown[]) => void
				const emit = api.emit.bind(api) as unknown as AnyEmit
				api.on("element:click", (elId) => emit("editor:select", [elId]))
			},
		}

		// ── Editor ────────────────────────────────────────────────────────────
		const paletteEditorPlugin = createCommandPaletteEditorPlugin(
			bridgePalette,
			() => editorRef.current,
		)
		const connectorCatalog = createConnectorCatalogPlugin(configPanelBpmn, bridgePalette)

		const editor = new BpmnEditor({
			container,
			theme: useThemeStore.getState().theme,
			fit: "center",
			plugins: [paletteEditorPlugin, bridgePlugin, configPanel, configPanelBpmn, connectorCatalog],
		})
		initEditorHud(editor, {
			onToggleSidebar: () => {
				if (dock.collapsed) dock.expand()
				else dock.collapse()
			},
		})
		editorRef.current = editor

		// Update docs pane when selection changes
		const offSelect = editor.on("editor:select", (ids) => {
			const type = ids.length === 1 && ids[0] ? editor.getElementType(ids[0]) : null
			renderDocs(type)
		})

		if (model.content) {
			editor.load(model.content)
		}

		const off = editor.on("diagram:change", () => {
			setSaveStatus("unsaved")
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
			saveTimerRef.current = setTimeout(() => {
				void doSave()
			}, 2000)
		})

		return () => {
			off()
			offSelect()
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
			render(null, dock.deployPane)
			render(null, dock.docsPane)
			dock.el.remove()
			dockRef.current = null
			editor.destroy() // triggers paletteEditorPlugin.uninstall() → clears element commands
			deregisterExtra()
			useUiStore.getState().clearContextCommands()
			editorRef.current = null
		}
	}, [id, loaded])

	// Sync editor theme
	useEffect(() => {
		editorRef.current?.setTheme(theme)
	}, [theme])

	// ⌘S saves immediately
	// biome-ignore lint/correctness/useExhaustiveDependencies: doSave reads from refs; id/model trigger re-registration
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault()
				void doSave()
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [id, model])

	async function doSave() {
		const editor = editorRef.current
		if (!editor || !model) return
		const xml = editor.exportXml()
		if (!xml) return
		setSaveStatus("saving")
		try {
			const updated = await saveModel({ ...model, content: xml })
			upsertModel(updated)
			setSaveStatus("saved")
		} catch {
			setSaveStatus("unsaved")
			toast.error("Failed to save model")
		}
	}

	if (!model) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
				<p className="text-lg font-medium text-fg">Model not found</p>
				<Link href="/models" className="text-sm text-accent hover:underline">
					← Back to Models
				</Link>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Save bar — h-10 (40px); dock starts at DOCK_TOP = TopBar(48) + this(40) = 88px */}
			<div className="flex items-center h-10 shrink-0 gap-3 px-3 border-b border-border bg-surface">
				<span
					className={`text-xs transition-colors ${
						saveStatus === "saved"
							? "text-success"
							: saveStatus === "saving"
								? "text-warn"
								: "text-muted"
					}`}
				>
					{saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : "Unsaved"}
				</span>
				<Button size="sm" variant="ghost" onClick={() => void doSave()}>
					<Save size={14} />
					Save
				</Button>
			</div>

			{/* Editor — full width; dock floats over the right edge */}
			<div ref={editorContainerRef} className="flex-1 overflow-hidden relative min-h-0" />
		</div>
	)
}
