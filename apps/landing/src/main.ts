import Viewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { examples } from "./examples";

interface BpmnCanvas {
	zoom(mode: "fit-viewport", center?: boolean): void;
	zoom(level: number): void;
}

const viewers = new Map<string, InstanceType<typeof Viewer>>();

function fitAndCenter(viewer: InstanceType<typeof Viewer>): void {
	const canvas = viewer.get("canvas") as BpmnCanvas;
	canvas.zoom("fit-viewport", true);
}

async function renderDiagram(key: string): Promise<void> {
	const container = document.getElementById(`diagram-${key}`);
	if (!container || !examples[key]) return;

	if (viewers.has(key)) {
		const viewer = viewers.get(key);
		if (!viewer) return;
		fitAndCenter(viewer);
		return;
	}

	const viewer = new Viewer({ container });
	viewers.set(key, viewer);

	try {
		await viewer.importXML(examples[key]);
		fitAndCenter(viewer);
	} catch (err) {
		console.error(`Failed to render ${key}:`, err);
	}
}

function escapeHtml(str: string): string {
	return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function populateXmlPanels(): void {
	const panels = document.querySelectorAll<HTMLElement>(".example-xml[data-example]");
	for (const panel of panels) {
		const key = panel.dataset.example;
		if (!key || !examples[key]) continue;
		const pre = document.createElement("pre");
		const code = document.createElement("code");
		code.textContent = "";
		code.innerHTML = escapeHtml(examples[key]);
		pre.appendChild(code);
		panel.appendChild(pre);
	}
}

function setupTabs(): void {
	const tabs = document.querySelectorAll<HTMLElement>(".tab");
	const panels = document.querySelectorAll<HTMLElement>(".example-panel");

	for (const tab of tabs) {
		tab.addEventListener("click", () => {
			const example = tab.dataset.example;
			if (!example) return;

			for (const t of tabs) t.classList.remove("active");
			for (const p of panels) p.classList.remove("active");

			tab.classList.add("active");
			const panel = document.querySelector<HTMLElement>(
				`.example-panel[data-example="${example}"]`,
			);
			if (panel) {
				panel.classList.add("active");
				renderDiagram(example);
			}
		});
	}
}

function setupOutputTabs(): void {
	const outputPanels = document.querySelectorAll<HTMLElement>(".example-output");
	for (const panel of outputPanels) {
		const tabs = panel.querySelectorAll<HTMLElement>(".output-tab");
		const views = panel.querySelectorAll<HTMLElement>(".output-view");

		for (const tab of tabs) {
			tab.addEventListener("click", () => {
				const view = tab.dataset.view;
				if (!view) return;

				for (const t of tabs) t.classList.remove("active");
				for (const v of views) v.classList.remove("active");

				tab.classList.add("active");
				const target = panel.querySelector<HTMLElement>(`.output-view[data-view="${view}"]`);
				if (target) {
					target.classList.add("active");
					// Re-fit diagram if switching back to it
					if (view === "diagram") {
						const diagramEl = target as HTMLElement;
						const id = diagramEl.id;
						const key = id.replace("diagram-", "");
						const viewer = viewers.get(key);
						if (viewer) {
							fitAndCenter(viewer);
						}
					}
				}
			});
		}
	}
}

function setupPkgTabs(): void {
	const tabs = document.querySelectorAll<HTMLElement>(".pkg-tab");
	for (const tab of tabs) {
		tab.addEventListener("click", () => {
			const pkg = tab.dataset.pkg;
			if (!pkg) return;
			const step = tab.closest(".step");
			if (!step) return;

			for (const t of step.querySelectorAll<HTMLElement>(".pkg-tab")) t.classList.remove("active");
			for (const c of step.querySelectorAll<HTMLElement>(".pkg-cmd")) c.classList.remove("active");

			tab.classList.add("active");
			const cmd = step.querySelector<HTMLElement>(`.pkg-cmd[data-pkg="${pkg}"]`);
			if (cmd) cmd.classList.add("active");
		});
	}
}

function setupCopyButtons(): void {
	const blocks = document.querySelectorAll<HTMLElement>("pre");
	for (const pre of blocks) {
		const wrapper = document.createElement("div");
		wrapper.className = "copy-wrapper";
		pre.parentNode?.insertBefore(wrapper, pre);
		wrapper.appendChild(pre);

		const btn = document.createElement("button");
		btn.className = "copy-btn";
		btn.textContent = "Copy";
		btn.type = "button";
		wrapper.appendChild(btn);

		btn.addEventListener("click", () => {
			const code = pre.querySelector("code");
			const text = (code ?? pre).textContent ?? "";
			navigator.clipboard.writeText(text.trim()).then(() => {
				btn.textContent = "Copied!";
				btn.classList.add("copied");
				setTimeout(() => {
					btn.textContent = "Copy";
					btn.classList.remove("copied");
				}, 1500);
			});
		});
	}
}

// Init
setupCopyButtons();
populateXmlPanels();
setupTabs();
setupOutputTabs();
setupPkgTabs();
renderDiagram("simple");
