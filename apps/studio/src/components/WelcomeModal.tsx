import { FilePlus2, Rocket, Sparkles } from "lucide-react"
import { useEffect } from "preact/hooks"
import { useLocation } from "wouter"
import { getOnboardingState, markExampleOpened, markSeen } from "../lib/onboarding.js"
import { useModelsStore } from "../stores/models.js"
import { useUiStore } from "../stores/ui.js"
import { PROCESS_TEMPLATES } from "../templates/index.js"
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog.js"

export function WelcomeModal() {
	const { showWelcomeModal, openWelcomeModal, closeWelcomeModal } = useUiStore()
	const { saveModel } = useModelsStore()
	const [, navigate] = useLocation()

	// Auto-show on first visit
	useEffect(() => {
		if (!getOnboardingState().seen) {
			openWelcomeModal()
		}
	}, [openWelcomeModal])

	function dismiss() {
		markSeen()
		closeWelcomeModal()
	}

	async function handleOpenExample() {
		const tpl = PROCESS_TEMPLATES.find((t) => t.id === "tpl-fetch-summarize-webpage")
		if (!tpl) {
			console.error("onboarding: template tpl-fetch-summarize-webpage not found")
			dismiss()
			return
		}
		markExampleOpened()
		dismiss()
		try {
			const model = await saveModel({
				id: crypto.randomUUID(),
				name: tpl.name,
				type: "bpmn",
				content: tpl.bpmn,
				createdAt: Date.now(),
			})
			navigate(`/models/${model.id}`)
		} catch (err) {
			console.error("onboarding: failed to save example model", err)
		}
	}

	function handleStartScratch() {
		dismiss()
		navigate("/models")
	}

	function handleConnectCluster() {
		dismiss()
		navigate("/settings")
	}

	return (
		<Dialog open={showWelcomeModal} onOpenChange={(o: boolean) => !o && dismiss()}>
			<DialogContent className="max-w-md">
				<div className="flex flex-col items-center text-center gap-2 pt-2 pb-1">
					<div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/15 mb-1">
						<Rocket size={22} className="text-accent" />
					</div>
					<DialogTitle className="text-xl font-semibold text-fg">
						Welcome to BPMNkit Studio
					</DialogTitle>
					<p className="text-sm text-muted">
						Design, deploy, and monitor BPMN processes for Zeebe workflows.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-3 mt-2">
					<button
						type="button"
						onClick={() => void handleOpenExample()}
						className="flex flex-col items-start gap-1.5 rounded-lg border border-accent bg-accent/10 p-4 text-left hover:bg-accent/15 transition-colors"
					>
						<Sparkles size={18} className="text-accent" />
						<span className="text-sm font-medium text-fg">Open example process</span>
						<span className="text-xs text-muted">
							HTTP request + AI summarise — ready to explore
						</span>
					</button>
					<button
						type="button"
						onClick={handleStartScratch}
						className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-surface p-4 text-left hover:bg-surface-2 transition-colors"
					>
						<FilePlus2 size={18} className="text-fg" />
						<span className="text-sm font-medium text-fg">Start from scratch</span>
						<span className="text-xs text-muted">Open the editor and design your own process</span>
					</button>
				</div>

				<div className="mt-1 flex items-center justify-between">
					<button
						type="button"
						onClick={handleConnectCluster}
						className="text-xs text-accent hover:underline"
					>
						Already have a cluster? Connect it →
					</button>
					<button
						type="button"
						onClick={dismiss}
						className="text-xs text-muted hover:text-fg transition-colors"
					>
						Skip for now
					</button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
