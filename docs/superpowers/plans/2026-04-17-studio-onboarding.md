# Studio Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a welcome modal + dashboard checklist + sidebar link that guides new users through opening an example process, connecting a Zeebe cluster, deploying, and running their first instance.

**Architecture:** Onboarding state lives in `localStorage` (5 keys). A new `src/lib/onboarding.ts` utility centralises key constants and read/write helpers. The `WelcomeModal` renders in `app.tsx` at the root level (appears on any page). The `OnboardingChecklist` lives inside `Dashboard.tsx` as a component function. The sidebar "Get started" link calls `openWelcomeModal()` from `useUiStore`.

**Tech Stack:** TypeScript, Preact, Zustand (`useUiStore`), Lucide icons, Tailwind CSS (existing token classes), Vitest for utility tests.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/onboarding.ts` | localStorage key constants + read/write helpers |
| Create | `tests/onboarding.test.ts` | Unit tests for onboarding state helpers |
| Modify | `src/stores/ui.ts` | Add `showWelcomeModal: boolean` + `openWelcomeModal(): void` |
| Create | `src/components/WelcomeModal.tsx` | Welcome modal component |
| Modify | `src/app.tsx` | Render `<WelcomeModal />` at root |
| Modify | `src/pages/Dashboard.tsx` | Add `<OnboardingChecklist />` above stats |
| Modify | `src/layout/Sidebar.tsx` | Add "Get started" button above collapse toggle |

---

### Task 1: Create `src/lib/onboarding.ts`

**Files:**
- Create: `apps/studio/src/lib/onboarding.ts`

- [ ] **Step 1: Write the file**

```typescript
// localStorage keys — centralised to prevent typos
export const ONBOARDING_SEEN = "bpmnkit:onboarding-seen"
export const ONBOARDING_EXAMPLE_OPENED = "bpmnkit:onboarding-example-opened"
export const ONBOARDING_INSTANCE_STARTED = "bpmnkit:onboarding-instance-started"
export const ONBOARDING_HIDDEN = "bpmnkit:onboarding-hidden"
export const ONBOARDING_COLLAPSED = "bpmnkit:onboarding-collapsed"

function get(key: string): boolean {
	try {
		return localStorage.getItem(key) === "true"
	} catch {
		return false
	}
}

function set(key: string): void {
	try {
		localStorage.setItem(key, "true")
	} catch {
		// storage unavailable
	}
}

function remove(key: string): void {
	try {
		localStorage.removeItem(key)
	} catch {
		// storage unavailable
	}
}

export interface OnboardingState {
	seen: boolean
	exampleOpened: boolean
	instanceStarted: boolean
	hidden: boolean
	collapsed: boolean
}

export function getOnboardingState(): OnboardingState {
	return {
		seen: get(ONBOARDING_SEEN),
		exampleOpened: get(ONBOARDING_EXAMPLE_OPENED),
		instanceStarted: get(ONBOARDING_INSTANCE_STARTED),
		hidden: get(ONBOARDING_HIDDEN),
		collapsed: get(ONBOARDING_COLLAPSED),
	}
}

export function markSeen(): void {
	set(ONBOARDING_SEEN)
}

export function markExampleOpened(): void {
	set(ONBOARDING_EXAMPLE_OPENED)
}

export function markInstanceStarted(): void {
	set(ONBOARDING_INSTANCE_STARTED)
}

export function hideOnboarding(): void {
	set(ONBOARDING_HIDDEN)
}

export function setCollapsed(collapsed: boolean): void {
	if (collapsed) {
		set(ONBOARDING_COLLAPSED)
	} else {
		remove(ONBOARDING_COLLAPSED)
	}
}
```

- [ ] **Step 2: Verify file exists and has no TypeScript errors**

```bash
cd apps/studio && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors relating to `src/lib/onboarding.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/lib/onboarding.ts
git commit -m "feat(studio): add onboarding localStorage utility"
```

---

### Task 2: Write tests for `onboarding.ts`

**Files:**
- Create: `apps/studio/tests/onboarding.test.ts`

Note: Vitest config includes only `tests/**/*.test.ts`. The test environment has no `localStorage`, so we mock it. The `onboarding.ts` helper silently returns `false` / no-ops when storage throws — test the happy path only.

- [ ] **Step 1: Write the test file**

```typescript
import { beforeEach, describe, expect, it } from "vitest"
import {
	ONBOARDING_COLLAPSED,
	ONBOARDING_EXAMPLE_OPENED,
	ONBOARDING_HIDDEN,
	ONBOARDING_INSTANCE_STARTED,
	ONBOARDING_SEEN,
	getOnboardingState,
	hideOnboarding,
	markExampleOpened,
	markInstanceStarted,
	markSeen,
	setCollapsed,
} from "../src/lib/onboarding.js"

// Minimal localStorage shim for Node/Vitest
const store: Record<string, string> = {}
const localStorageMock = {
	getItem: (k: string) => store[k] ?? null,
	setItem: (k: string, v: string) => { store[k] = v },
	removeItem: (k: string) => { delete store[k] },
}
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true })

beforeEach(() => {
	for (const k of Object.keys(store)) delete store[k]
})

describe("getOnboardingState", () => {
	it("returns all false on fresh install", () => {
		expect(getOnboardingState()).toEqual({
			seen: false,
			exampleOpened: false,
			instanceStarted: false,
			hidden: false,
			collapsed: false,
		})
	})

	it("reflects markSeen", () => {
		markSeen()
		expect(getOnboardingState().seen).toBe(true)
	})

	it("reflects markExampleOpened", () => {
		markExampleOpened()
		expect(getOnboardingState().exampleOpened).toBe(true)
	})

	it("reflects markInstanceStarted", () => {
		markInstanceStarted()
		expect(getOnboardingState().instanceStarted).toBe(true)
	})

	it("reflects hideOnboarding", () => {
		hideOnboarding()
		expect(getOnboardingState().hidden).toBe(true)
	})

	it("reflects setCollapsed true then false", () => {
		setCollapsed(true)
		expect(getOnboardingState().collapsed).toBe(true)
		setCollapsed(false)
		expect(getOnboardingState().collapsed).toBe(false)
	})
})

describe("key constants", () => {
	it("each key is distinct", () => {
		const keys = [
			ONBOARDING_SEEN,
			ONBOARDING_EXAMPLE_OPENED,
			ONBOARDING_INSTANCE_STARTED,
			ONBOARDING_HIDDEN,
			ONBOARDING_COLLAPSED,
		]
		expect(new Set(keys).size).toBe(keys.length)
	})
})
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
cd apps/studio && pnpm vitest run tests/onboarding.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/tests/onboarding.test.ts
git commit -m "test(studio): add onboarding state utility tests"
```

---

### Task 3: Add `showWelcomeModal` / `openWelcomeModal` to `useUiStore`

**Files:**
- Modify: `apps/studio/src/stores/ui.ts`

- [ ] **Step 1: Add state and action to the interface**

In `src/stores/ui.ts`, add to the `UiState` interface (after `zenMode: boolean`):

```typescript
	showWelcomeModal: boolean
	openWelcomeModal(): void
	closeWelcomeModal(): void
```

- [ ] **Step 2: Add initial state and implementation**

In the `create()` call, after `zenMode: false,` add:

```typescript
	showWelcomeModal: false,
```

After `exitZenMode: () => set({ zenMode: false }),` add:

```typescript
	openWelcomeModal: () => set({ showWelcomeModal: true }),
	closeWelcomeModal: () => set({ showWelcomeModal: false }),
```

- [ ] **Step 3: Verify no type errors**

```bash
cd apps/studio && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/stores/ui.ts
git commit -m "feat(studio): add showWelcomeModal state to useUiStore"
```

---

### Task 4: Create `WelcomeModal.tsx`

**Files:**
- Create: `apps/studio/src/components/WelcomeModal.tsx`

The modal auto-shows on mount if `!onboarding.seen`. Closing it marks `seen`. "Open example" creates the `tpl-fetch-summarize-webpage` template as a model in IndexedDB and navigates to the editor. "Start from scratch" navigates to `/models`. "Connect cluster" navigates to `/settings`.

- [ ] **Step 1: Write the component**

```typescript
import { Rocket, Sparkles, X } from "lucide-react"
import { useEffect, useState } from "preact/hooks"
import { useLocation } from "wouter"
import { Button } from "./ui/button.js"
import { Dialog, DialogContent } from "./ui/dialog.js"
import { PROCESS_TEMPLATES } from "../templates/index.js"
import { useModelsStore } from "../stores/models.js"
import { useUiStore } from "../stores/ui.js"
import { getOnboardingState, markExampleOpened, markSeen } from "../lib/onboarding.js"

export function WelcomeModal() {
	const { showWelcomeModal, closeWelcomeModal } = useUiStore()
	const { saveModel } = useModelsStore()
	const [, navigate] = useLocation()
	const [open, setOpen] = useState(false)

	// Auto-show on first visit
	useEffect(() => {
		if (!getOnboardingState().seen) {
			setOpen(true)
		}
	}, [])

	// Allow external re-open via store flag
	useEffect(() => {
		if (showWelcomeModal) {
			setOpen(true)
		}
	}, [showWelcomeModal])

	function dismiss() {
		markSeen()
		setOpen(false)
		closeWelcomeModal()
	}

	async function handleOpenExample() {
		const tpl = PROCESS_TEMPLATES.find((t) => t.id === "tpl-fetch-summarize-webpage")
		if (!tpl) return
		markExampleOpened()
		markSeen()
		setOpen(false)
		closeWelcomeModal()
		const model = await saveModel({
			id: crypto.randomUUID(),
			name: tpl.name,
			type: "bpmn",
			content: tpl.bpmn,
			createdAt: Date.now(),
		})
		navigate(`/models/${model.id}`)
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
		<Dialog open={open} onOpenChange={(o: boolean) => !o && dismiss()}>
			<DialogContent className="max-w-md">
				<button
					type="button"
					onClick={dismiss}
					className="absolute right-4 top-4 text-muted hover:text-fg transition-colors"
					aria-label="Close"
				>
					<X size={16} />
				</button>

				<div className="flex flex-col items-center text-center gap-2 pt-2 pb-1">
					<div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/15 mb-1">
						<Rocket size={22} className="text-accent" />
					</div>
					<h2 className="text-xl font-semibold text-fg">Welcome to BPMNkit Studio</h2>
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
						<span className="text-xs text-muted">HTTP request + AI summarise — ready to explore</span>
					</button>
					<button
						type="button"
						onClick={handleStartScratch}
						className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-surface p-4 text-left hover:bg-surface-2 transition-colors"
					>
						<Rocket size={18} className="text-fg" />
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
```

- [ ] **Step 2: Check for type errors**

```bash
cd apps/studio && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/components/WelcomeModal.tsx
git commit -m "feat(studio): add WelcomeModal component"
```

---

### Task 5: Wire `WelcomeModal` into `app.tsx`

**Files:**
- Modify: `apps/studio/src/app.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/app.tsx`, after the existing imports, add:

```typescript
import { WelcomeModal } from "./components/WelcomeModal.js"
```

- [ ] **Step 2: Render `WelcomeModal` inside the providers, after `<Shell>`**

Inside the `App` function's return, add `<WelcomeModal />` as a sibling of `<Router>`:

```typescript
export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<Router>
					<Shell>
						<Switch>
							{/* ... all routes unchanged ... */}
						</Switch>
					</Shell>
				</Router>
				<WelcomeModal />
			</TooltipProvider>
		</QueryClientProvider>
	)
}
```

- [ ] **Step 3: Check for type errors and lint**

```bash
cd apps/studio && pnpm tsc --noEmit 2>&1 | head -20
pnpm biome check src/app.tsx 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/app.tsx
git commit -m "feat(studio): render WelcomeModal at app root"
```

---

### Task 6: Add `OnboardingChecklist` to `Dashboard.tsx`

**Files:**
- Modify: `apps/studio/src/pages/Dashboard.tsx`

The checklist is a self-contained component function declared inside `Dashboard.tsx` (same file pattern as `GettingStarted`). It reads `useClusterStore` for step 2 completion, `useDashboardStats` for steps 3 and 4, and localStorage via `getOnboardingState()` for steps 1 and 4 (instance-started override).

- [ ] **Step 1: Add required imports at the top of `Dashboard.tsx`**

Add to the existing lucide import line (which already has `AlertTriangle`, `CheckSquare`, `FileCode2`, `GitBranch`, `Layers`, `Play`, `RefreshCw`, `Rocket`, `WifiOff`, `X`, `Zap`):

```typescript
import { ..., ChevronDown, ChevronUp } from "lucide-react"
```

Add these new imports (the others — `useUiStore`, `useModelsStore`, `useClusterStore`, `useEffect`, `useState` — are already imported):

```typescript
import { useLocation } from "wouter"  // add to existing wouter import: import { Link, useLocation } from "wouter"
import {
	getOnboardingState,
	hideOnboarding,
	markExampleOpened,
	markInstanceStarted,
	setCollapsed,
} from "../lib/onboarding.js"
import { PROCESS_TEMPLATES } from "../templates/index.js"
```

Note: `useUiStore`, `useModelsStore`, `useClusterStore`, `useState`, `useEffect`, and `X` are already imported. Add only what's missing.

- [ ] **Step 2: Add the `OnboardingChecklist` component function**

Add this function above the `Dashboard` function (after the existing `GettingStarted` function):

```typescript
function OnboardingChecklist() {
	const { data: stats } = useDashboardStats()
	const { activeProfile } = useClusterStore()
	const { saveModel } = useModelsStore()
	const { openWelcomeModal } = useUiStore()
	const [, navigate] = useLocation()

	const obs = getOnboardingState()
	const [hidden, setHidden] = useState(obs.hidden)
	const [collapsed, setLocalCollapsed] = useState(obs.collapsed)
	const [exampleOpened, setExampleOpened] = useState(obs.exampleOpened)
	const [instanceStarted, setInstanceStarted] = useState(obs.instanceStarted)

	if (hidden) return null

	const step1Done = exampleOpened
	const step2Done = !!activeProfile
	const step3Done = (stats?.deployedDefinitions ?? 0) > 0
	const step4Done = (stats?.runningInstances ?? 0) > 0 || instanceStarted

	const completedCount = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length
	const allDone = completedCount === 4

	// Auto-hide after all steps complete (on next render cycle)
	useEffect(() => {
		if (allDone) {
			const t = setTimeout(() => {
				hideOnboarding()
				setHidden(true)
			}, 3000)
			return () => clearTimeout(t)
		}
	}, [allDone])

	function handleHide() {
		hideOnboarding()
		setHidden(true)
	}

	function handleToggleCollapse() {
		const next = !collapsed
		setLocalCollapsed(next)
		setCollapsed(next)
	}

	async function handleOpenExample() {
		const tpl = PROCESS_TEMPLATES.find((t) => t.id === "tpl-fetch-summarize-webpage")
		if (!tpl) return
		markExampleOpened()
		setExampleOpened(true)
		const model = await saveModel({
			id: crypto.randomUUID(),
			name: tpl.name,
			type: "bpmn",
			content: tpl.bpmn,
			createdAt: Date.now(),
		})
		navigate(`/models/${model.id}`)
	}

	const steps = [
		{
			label: "Open an example process",
			description: "See a real BPMN workflow with HTTP and AI steps.",
			done: step1Done,
			action: !step1Done ? (
				<Button size="sm" variant="outline" onClick={() => void handleOpenExample()}>
					Open example →
				</Button>
			) : null,
		},
		{
			label: "Connect a Zeebe cluster",
			description: "Use the CLI to connect Studio to your Camunda cluster.",
			done: step2Done,
			action: !step2Done ? (
				<div className="flex flex-col gap-2 mt-2">
					<pre className="rounded bg-surface-2 border border-border px-3 py-2 text-xs font-mono text-fg whitespace-pre-wrap leading-relaxed">{`# Install CLI
npm install -g @bpmnkit/cli

# Add a Zeebe profile
casen profile add my-cluster \\
  --base-url https://... \\
  --auth-type oauth2 \\
  --client-id YOUR_ID \\
  --client-secret YOUR_SECRET

# Launch Studio with that profile
casen studio --profile my-cluster`}</pre>
					<Button size="sm" variant="outline" onClick={() => navigate("/settings")}>
						Configure in Settings →
					</Button>
				</div>
			) : null,
		},
		{
			label: "Deploy a definition",
			description: "Push a process model to your connected cluster.",
			done: step3Done,
			action: !step3Done && step2Done ? (
				<Button size="sm" variant="outline" onClick={() => navigate("/definitions")}>
					Go to Definitions →
				</Button>
			) : null,
		},
		{
			label: "Run your first instance",
			description: "Trigger an instance and watch it execute.",
			done: step4Done,
			action: !step4Done && step3Done ? (
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						markInstanceStarted()
						setInstanceStarted(true)
						navigate("/instances")
					}}
				>
					Start an instance →
				</Button>
			) : null,
		},
	]

	return (
		<div className="rounded-lg border border-accent/30 bg-accent/5 overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2.5">
				<button
					type="button"
					onClick={handleToggleCollapse}
					className="flex items-center gap-2 text-sm font-medium text-fg hover:text-accent transition-colors"
				>
					{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
					{allDone ? (
						<span className="text-success">✓ All set! You're ready to automate.</span>
					) : (
						<>
							<span>Get started</span>
							<span className="text-muted font-normal">
								{completedCount}/{steps.length} steps
							</span>
						</>
					)}
				</button>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => openWelcomeModal()}
						className="text-xs text-muted hover:text-fg transition-colors"
					>
						Welcome guide
					</button>
					<button
						type="button"
						onClick={handleHide}
						className="text-muted hover:text-fg transition-colors"
						aria-label="Hide checklist"
					>
						<X size={14} />
					</button>
				</div>
			</div>

			{/* Progress bar */}
			<div className="h-0.5 bg-border mx-4">
				<div
					className="h-full bg-accent transition-all duration-500"
					style={{ width: `${(completedCount / steps.length) * 100}%` }}
				/>
			</div>

			{/* Steps */}
			{!collapsed && (
				<div className="px-4 py-3 flex flex-col gap-3">
					{steps.map((step) => (
						<div key={step.label} className="flex gap-3">
							<div className="mt-0.5 shrink-0">
								{step.done ? (
									<span className="flex items-center justify-center w-5 h-5 rounded-full bg-success/20 text-success text-xs">
										✓
									</span>
								) : (
									<span className="flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted text-xs">
										○
									</span>
								)}
							</div>
							<div className="flex flex-col gap-1">
								<span className={`text-sm font-medium ${step.done ? "text-muted line-through" : "text-fg"}`}>
									{step.label}
								</span>
								{!step.done && (
									<span className="text-xs text-muted">{step.description}</span>
								)}
								{!step.done && step.action}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
```

Note: `X` from lucide is already imported in Dashboard.tsx via `useUiStore` / existing imports. Verify and add if needed.

- [ ] **Step 3: Render `<OnboardingChecklist />` at the top of the Dashboard return**

In the `Dashboard` component's return JSX, add `<OnboardingChecklist />` as the first child, before the `{/* Status header */}` block:

```typescript
return (
	<div className="flex flex-col gap-5 p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
		<OnboardingChecklist />

		{/* Status header */}
		<StatusHeader ... />
		{/* ... rest unchanged ... */}
	</div>
)
```

- [ ] **Step 4: Remove or leave the old `showGettingStarted` / `GettingStarted` block**

The old `GettingStarted` component (around line 364) and `showGettingStarted` condition only appears when connected to a cluster with 0 definitions and 0 instances. The new `OnboardingChecklist` replaces this use case. Delete the `GettingStarted` function and the `showGettingStarted` variable and its render call `{showGettingStarted && <GettingStarted />}`.

- [ ] **Step 5: Check for type errors and lint**

```bash
cd apps/studio && pnpm tsc --noEmit 2>&1 | head -30
pnpm biome check src/pages/Dashboard.tsx 2>&1 | head -30
```

Fix any errors. Common issue: `X` icon might not be imported — add `X` to the lucide import if missing.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/pages/Dashboard.tsx
git commit -m "feat(studio): add OnboardingChecklist to Dashboard"
```

---

### Task 7: Add "Get started" link to `Sidebar.tsx`

**Files:**
- Modify: `apps/studio/src/layout/Sidebar.tsx`

- [ ] **Step 1: Add required imports**

In `Sidebar.tsx`, add to the existing lucide import line:

```typescript
import { Sparkles } from "lucide-react"
```

Add to the `useUiStore` destructure (around line 104):

```typescript
const { sidebarExpanded, toggleSidebar, setSidebarExpanded, openCommandPalette, openWelcomeModal } = useUiStore()
```

Also import `getOnboardingState` and `hideOnboarding` at the top:

```typescript
import { getOnboardingState } from "../lib/onboarding.js"
```

- [ ] **Step 2: Add the "Get started" button above the collapse toggle**

The collapse toggle is in a `<div>` starting at around line 362 (`{/* Bottom: collapse toggle */}`). Add the "Get started" button just before that div:

```typescript
			{/* Get started */}
			{!getOnboardingState().hidden && (
				<div className="px-2">
					<button
						type="button"
						onClick={openWelcomeModal}
						className={`flex w-full items-center gap-3 rounded-md h-9 px-2.5 text-nav-fg hover:text-nav-fg-active hover:bg-white/5 active:bg-white/10 transition-colors duration-150 ${
							sidebarExpanded ? "justify-start" : "justify-center"
						}`}
						aria-label="Get started"
						title="Get started"
					>
						<Sparkles size={18} className="shrink-0 text-accent" />
						<span
							className={`text-sm whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-150 ${
								sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
							}`}
						>
							Get started
						</span>
					</button>
				</div>
			)}

			{/* Bottom: collapse toggle */}
			<div className="px-2 pt-2 border-t border-white/10 mt-2">
				{/* ... existing collapse button unchanged ... */}
			</div>
```

- [ ] **Step 3: Check for type errors and lint**

```bash
cd apps/studio && pnpm tsc --noEmit 2>&1 | head -20
pnpm biome check src/layout/Sidebar.tsx 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/layout/Sidebar.tsx
git commit -m "feat(studio): add Get started link to Sidebar"
```

---

### Task 8: Final verification

**Files:** all modified files

- [ ] **Step 1: Run all tests**

```bash
cd apps/studio && pnpm vitest run
```

Expected: all tests pass including `onboarding.test.ts`.

- [ ] **Step 2: Full type-check**

```bash
cd apps/studio && pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Lint and format check**

```bash
pnpm biome check apps/studio/src apps/studio/tests
```

Expected: zero errors, zero warnings.

- [ ] **Step 4: Build**

```bash
pnpm turbo build --filter=studio
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Manual smoke test**

Start the dev server and verify:
1. Fresh visit (clear `bpmnkit:onboarding-*` keys from DevTools → Application → Local Storage) → welcome modal appears
2. "Open example process" → navigates to editor with "Fetch and Summarize Webpage" process loaded
3. Back on Dashboard → checklist visible, step 1 checked
4. Sidebar shows "Get started" link → clicking it re-opens the modal
5. Checklist "Hide" button → checklist disappears, sidebar link disappears

- [ ] **Step 6: Update doc/progress.md**

Add entry:

```markdown
## [date] Studio onboarding
- Added welcome modal (auto-shown first visit, re-openable via sidebar)
- Added onboarding checklist to Dashboard (4 steps, collapsible, auto-hides when complete)
- Added "Get started" sidebar link
- Fixed IndexedDB folder race condition in Models view
- Fixed file input not resetting after import in Models view
```

- [ ] **Step 7: Final commit**

```bash
git add doc/progress.md
git commit -m "docs: update progress for onboarding feature"
```
