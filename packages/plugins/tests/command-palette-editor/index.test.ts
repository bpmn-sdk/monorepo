import type { CanvasApi, RenderedShape } from "@bpmnkit/canvas"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createCommandPaletteEditorPlugin } from "../../src/command-palette-editor/index.js"
import { createCommandPalettePlugin } from "../../src/command-palette/index.js"

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeApi(shapes: RenderedShape[] = []): CanvasApi {
	const container = document.createElement("div")
	document.body.appendChild(container)
	return {
		container,
		svg: document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement,
		viewportEl: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
		getViewport: () => ({ tx: 0, ty: 0, scale: 1 }),
		setViewport: vi.fn(),
		getShapes: () => shapes,
		getEdges: () => [],
		getTheme: () => "dark" as const,
		setTheme: vi.fn(),
		on: (_event: unknown, _handler: unknown) => () => {},
		emit: vi.fn(),
	}
}

function makeShape(
	id: string,
	type: string,
	name?: string,
	outgoing: string[] = [],
): RenderedShape {
	return {
		id,
		element: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
		shape: {
			id: `${id}_di`,
			bpmnElement: id,
			bounds: { x: 100, y: 100, width: 100, height: 80 },
		},
		flowElement: { id, type, name, incoming: [], outgoing, extensionElements: [] } as never,
	}
}

function ctrlK(): void {
	document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
}

function esc(): void {
	document
		.querySelector(".bpmnkit-palette-overlay")
		?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
}

function enter(): void {
	document
		.querySelector(".bpmnkit-palette-overlay")
		?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
}

beforeEach(() => {
	document.body.innerHTML = ""
	document.head.innerHTML = ""
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("createCommandPaletteEditorPlugin", () => {
	it("registers element commands when installed", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi()
		palette.install(api)
		editorPlugin.install(api)

		// Open palette and check that element commands appear
		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "Add"
		input.dispatchEvent(new Event("input", { bubbles: true }))
		const items = document.querySelectorAll(".bpmnkit-palette-item")
		expect(items.length).toBe(41) // 40 element types + 1 matching doc entry
	})

	it("deregisters commands on uninstall", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi()
		palette.install(api)
		editorPlugin.install(api)
		editorPlugin.uninstall?.()

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "xyznotfound"
		input.dispatchEvent(new Event("input", { bubbles: true }))
		// Commands deregistered and no matching docs — empty state shown
		expect(document.querySelector(".bpmnkit-palette-empty")).not.toBeNull()
	})

	it("falls back to setTool when diagram is empty", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi() // no shapes
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "service task"
		input.dispatchEvent(new Event("input", { bubbles: true }))
		const item = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!item) throw new Error("item not found")
		item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
		expect(editorMock.setTool).toHaveBeenCalledWith("create:serviceTask")
	})

	it("pushes a target-selection view when diagram has nodes", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const shapes = [
			makeShape("task1", "serviceTask", "My Task"),
			makeShape("task2", "userTask", "Review"),
		]
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi(shapes)
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "service task"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		// Select "Add Service Task" — should push the target view
		const item = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!item) throw new Error("item not found")
		item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))

		// setTool should NOT have been called
		expect(editorMock.setTool).not.toHaveBeenCalled()

		// Palette should now show the target nodes
		const targetItems = document.querySelectorAll(".bpmnkit-palette-item")
		expect(targetItems.length).toBe(2) // task1 + task2
		expect(input.placeholder).toBe("Connect after which element?")
	})

	it("calls addConnectedElement when a target is selected and label confirmed", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const shapes = [makeShape("task1", "serviceTask", "My Task")]
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi(shapes)
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "service task"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		// Step 1: select element type
		const firstItem = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!firstItem) throw new Error("item not found")
		firstItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))

		// Step 2: select target node
		const targetItem = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!targetItem) throw new Error("target item not found")
		targetItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))

		// Step 3: confirm without a label (press Enter on empty input)
		expect(input.placeholder).toContain("Label for new")
		enter()

		expect(editorMock.addConnectedElement).toHaveBeenCalledWith("task1", "serviceTask", undefined)
		// Palette closes after confirmation
		expect(document.querySelector(".bpmnkit-palette-overlay")).toBeNull()
	})

	it("passes label to addConnectedElement when provided", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const shapes = [makeShape("task1", "serviceTask", "My Task")]
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi(shapes)
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "service task"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		// Step 1: select element type
		const firstItem = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!firstItem) throw new Error("item not found")
		firstItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))

		// Step 2: select target node
		const targetItem = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!targetItem) throw new Error("target item not found")
		targetItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))

		// Step 3: type a label and confirm
		input.value = "My New Task"
		enter()

		expect(editorMock.addConnectedElement).toHaveBeenCalledWith(
			"task1",
			"serviceTask",
			"My New Task",
		)
	})

	it("Escape navigates back through the view stack without closing", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const shapes = [makeShape("task1", "serviceTask", "My Task")]
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi(shapes)
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "service task"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		// Step 1 → target view
		const firstItem = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!firstItem) throw new Error("item not found")
		firstItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
		expect(input.placeholder).toBe("Connect after which element?")

		// Step 2 → label view
		const targetItem = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!targetItem) throw new Error("target item not found")
		targetItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
		expect(input.placeholder).toContain("Label for new")

		// Escape from label view → back to target view
		esc()
		expect(document.querySelector(".bpmnkit-palette-overlay")).not.toBeNull()
		expect(input.placeholder).toBe("Connect after which element?")

		// Escape from target view → back to main view
		esc()
		expect(document.querySelector(".bpmnkit-palette-overlay")).not.toBeNull()
		expect(input.placeholder).toBe("Search commands or docs\u2026")
	})

	it("excludes non-gateway nodes that already have an outgoing flow from candidates", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const shapes = [
			makeShape("start1", "startEvent", undefined, ["flow1"]), // already has outgoing → excluded
			makeShape("task1", "serviceTask", "Do Work", ["flow2"]), // already has outgoing → excluded
			makeShape("gw1", "exclusiveGateway", undefined, ["flow3"]), // gateway → still included
			makeShape("task2", "userTask", "Review"), // no outgoing → included
		]
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi(shapes)
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "service task"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		const firstItem = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!firstItem) throw new Error("item not found")
		firstItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))

		// gw1 (gateway with outgoing) + task2 (no outgoing) — start1 and task1 excluded
		const targetItems = document.querySelectorAll(".bpmnkit-palette-item")
		expect(targetItems.length).toBe(2)
	})

	it("excludes end events from target candidates", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const shapes = [
			makeShape("start1", "startEvent"),
			makeShape("end1", "endEvent"), // should be excluded
			makeShape("task1", "serviceTask", "Do Work"),
		]
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)

		const api = makeApi(shapes)
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "service task"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		const firstItem = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!firstItem) throw new Error("item not found")
		firstItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))

		// Should show start1 + task1, not end1
		const targetItems = document.querySelectorAll(".bpmnkit-palette-item")
		expect(targetItems.length).toBe(2)
	})

	it("word-based query 'Add gateway' matches exclusive/parallel/inclusive gateways", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)
		const api = makeApi()
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "Add gateway"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		const titles = Array.from(
			document.querySelectorAll<HTMLElement>(".bpmnkit-palette-item-title"),
		).map((el) => el.textContent ?? "")
		expect(titles.some((t) => t.includes("Exclusive Gateway"))).toBe(true)
		expect(titles.some((t) => t.includes("Parallel Gateway"))).toBe(true)
		expect(titles.some((t) => t.includes("Inclusive Gateway"))).toBe(true)
	})

	it("each element type has a unique command id", () => {
		const palette = createCommandPalettePlugin()
		const editorMock = { setTool: vi.fn(), addConnectedElement: vi.fn() }
		const editorPlugin = createCommandPaletteEditorPlugin(palette, () => editorMock)
		const api = makeApi()
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "Add"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		const items = document.querySelectorAll(".bpmnkit-palette-item-title")
		const titles = Array.from(items).map((el) => el.textContent ?? "")
		const unique = new Set(titles)
		expect(unique.size).toBe(titles.length)
	})
})
