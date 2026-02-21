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

// Tab switching
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

// Init
setupTabs();
renderDiagram("simple");
