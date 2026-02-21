import Viewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import { examples } from "./examples";

const viewers = new Map<string, InstanceType<typeof Viewer>>();

async function renderDiagram(key: string): Promise<void> {
	const container = document.getElementById(`diagram-${key}`);
	if (!container || !examples[key]) return;

	if (viewers.has(key)) {
		const viewer = viewers.get(key);
		if (!viewer) return;
		const canvas = viewer.get("canvas") as { zoom: (mode: string) => void };
		canvas.zoom("fit-viewport");
		return;
	}

	const viewer = new Viewer({ container });
	viewers.set(key, viewer);

	try {
		await viewer.importXML(examples[key]);
		const canvas = viewer.get("canvas") as { zoom: (mode: string) => void };
		canvas.zoom("fit-viewport");
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
							const canvas = viewer.get("canvas") as {
								zoom: (mode: string) => void;
							};
							canvas.zoom("fit-viewport");
						}
					}
				}
			});
		}
	}
}

// Init
populateXmlPanels();
setupTabs();
setupOutputTabs();
renderDiagram("simple");
