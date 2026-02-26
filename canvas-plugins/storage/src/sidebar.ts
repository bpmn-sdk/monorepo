import type { StorageApi } from "./storage-api.js";
import type { FileRecord, ProjectRecord, WorkspaceRecord } from "./types.js";

// ─── SVG icons ───────────────────────────────────────────────────────────────

const ICON_FILES =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2h7l3 3v9H2z"/><path d="M9 2v3h3"/></svg>';

const ICON_FOLDER =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4h5l2 2h7v8H1z"/></svg>';

const ICON_FILE =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 1h7l3 3v11H3z"/><path d="M10 1v3h3"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="5" y1="11" x2="9" y2="11"/></svg>';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkEl<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	if (className) el.className = className;
	return el;
}

function mkBtn(className: string, title: string, text: string): HTMLButtonElement {
	const btn = mkEl("button", className);
	btn.type = "button";
	btn.title = title;
	btn.textContent = text;
	return btn;
}

function mkSvgBtn(className: string, title: string, svg: string): HTMLButtonElement {
	const btn = mkEl("button", className);
	btn.type = "button";
	btn.title = title;
	btn.innerHTML = svg;
	return btn;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export class StorageSidebar {
	private readonly _panel: HTMLDivElement;
	private readonly _toggle: HTMLButtonElement;
	private readonly _tree: HTMLDivElement;
	private readonly _offChange: () => void;
	private readonly _expanded = new Set<string>();
	private _open = false;

	constructor(
		private readonly _container: HTMLElement,
		private readonly _api: StorageApi,
	) {
		this._toggle = this._buildToggle();
		this._panel = this._buildPanel();
		this._tree = this._panel.querySelector(".bpmn-st-tree") as HTMLDivElement;

		_container.appendChild(this._toggle);
		_container.appendChild(this._panel);

		this._offChange = _api.onChange(() => {
			if (this._open) void this._render();
		});
	}

	destroy(): void {
		this._offChange();
		this._toggle.remove();
		this._panel.remove();
	}

	// ─── Build skeleton ───────────────────────────────────────────────────────

	private _buildToggle(): HTMLButtonElement {
		const btn = mkSvgBtn("bpmn-st-toggle", "Toggle file panel", ICON_FILES);
		btn.addEventListener("click", () => this._toggleOpen());
		return btn;
	}

	private _buildPanel(): HTMLDivElement {
		const panel = mkEl("div", "bpmn-st-panel");
		panel.style.display = "none";

		// Header
		const header = mkEl("div", "bpmn-st-header");
		const title = mkEl("span", "bpmn-st-header-title");
		title.textContent = "Files";

		const addWsBtn = mkBtn("bpmn-st-header-btn", "New workspace", "+ Workspace");
		addWsBtn.addEventListener("click", () => void this._handleAddWorkspace());

		const closeBtn = mkBtn("bpmn-st-close-btn", "Close", "×");
		closeBtn.addEventListener("click", () => this._toggleOpen());

		header.appendChild(title);
		header.appendChild(addWsBtn);
		header.appendChild(closeBtn);

		const tree = mkEl("div", "bpmn-st-tree");

		panel.appendChild(header);
		panel.appendChild(tree);
		return panel;
	}

	// ─── Open / close ─────────────────────────────────────────────────────────

	private _toggleOpen(): void {
		this._open = !this._open;
		this._panel.style.display = this._open ? "flex" : "none";
		if (this._open) void this._render();
	}

	// ─── Render tree ──────────────────────────────────────────────────────────

	private async _render(): Promise<void> {
		const workspaces = await this._api.getWorkspaces();
		this._tree.textContent = "";

		if (workspaces.length === 0) {
			const empty = mkEl("div", "bpmn-st-empty");
			empty.textContent = "No workspaces yet.\nClick '+ Workspace' to get started.";
			this._tree.appendChild(empty);
			return;
		}

		for (const ws of workspaces) {
			this._tree.appendChild(await this._buildWorkspace(ws));
		}
	}

	private async _buildWorkspace(ws: WorkspaceRecord): Promise<HTMLElement> {
		const container = mkEl("div");

		// Row
		const row = mkEl("div", "bpmn-st-row bpmn-st-ws-row");

		const chevron = mkEl("span", "bpmn-st-chevron");
		chevron.textContent = "▶";
		if (this._expanded.has(ws.id)) chevron.classList.add("open");

		const icon = mkEl("span", "bpmn-st-icon");
		icon.innerHTML = ICON_FOLDER;

		const name = mkEl("span", "bpmn-st-name");
		name.textContent = ws.name;

		const actions = mkEl("div", "bpmn-st-actions");
		const addProjBtn = mkBtn("bpmn-st-action-btn", "New project", "+");
		const renameBtn = mkBtn("bpmn-st-action-btn", "Rename", "✎");
		const deleteBtn = mkBtn("bpmn-st-action-btn", "Delete", "✕");
		actions.appendChild(addProjBtn);
		actions.appendChild(renameBtn);
		actions.appendChild(deleteBtn);

		row.appendChild(chevron);
		row.appendChild(icon);
		row.appendChild(name);
		row.appendChild(actions);

		// Body (projects)
		const body = mkEl("div");
		body.style.display = this._expanded.has(ws.id) ? "" : "none";

		row.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest(".bpmn-st-actions")) return;
			if (this._expanded.has(ws.id)) {
				this._expanded.delete(ws.id);
				chevron.classList.remove("open");
				body.style.display = "none";
			} else {
				this._expanded.add(ws.id);
				chevron.classList.add("open");
				body.style.display = "";
				void this._renderProjects(ws, body);
			}
		});

		addProjBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._handleAddProject(ws);
		});
		renameBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._handleRenameWorkspace(ws);
		});
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._handleDeleteWorkspace(ws);
		});

		if (this._expanded.has(ws.id)) {
			await this._renderProjects(ws, body);
		}

		container.appendChild(row);
		container.appendChild(body);
		return container;
	}

	private async _renderProjects(ws: WorkspaceRecord, container: HTMLElement): Promise<void> {
		container.textContent = "";
		const projects = await this._api.getProjects(ws.id);
		for (const proj of projects) {
			container.appendChild(await this._buildProject(ws, proj));
		}
		if (projects.length === 0) {
			const empty = mkEl("div", "bpmn-st-empty");
			empty.style.paddingLeft = "24px";
			empty.style.textAlign = "left";
			empty.textContent = "No projects — click + above";
			container.appendChild(empty);
		}
	}

	private async _buildProject(ws: WorkspaceRecord, proj: ProjectRecord): Promise<HTMLElement> {
		const container = mkEl("div");

		const row = mkEl("div", "bpmn-st-row bpmn-st-proj-row");

		const chevron = mkEl("span", "bpmn-st-chevron");
		chevron.textContent = "▶";
		if (this._expanded.has(proj.id)) chevron.classList.add("open");

		const icon = mkEl("span", "bpmn-st-icon");
		icon.innerHTML = ICON_FOLDER;

		const name = mkEl("span", "bpmn-st-name");
		name.textContent = proj.name;

		const actions = mkEl("div", "bpmn-st-actions");
		const addFileBtn = mkBtn("bpmn-st-action-btn", "New file", "+");
		const renameBtn = mkBtn("bpmn-st-action-btn", "Rename", "✎");
		const deleteBtn = mkBtn("bpmn-st-action-btn", "Delete", "✕");
		actions.appendChild(addFileBtn);
		actions.appendChild(renameBtn);
		actions.appendChild(deleteBtn);

		row.appendChild(chevron);
		row.appendChild(icon);
		row.appendChild(name);
		row.appendChild(actions);

		const body = mkEl("div");
		body.style.display = this._expanded.has(proj.id) ? "" : "none";

		row.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest(".bpmn-st-actions")) return;
			if (this._expanded.has(proj.id)) {
				this._expanded.delete(proj.id);
				chevron.classList.remove("open");
				body.style.display = "none";
			} else {
				this._expanded.add(proj.id);
				chevron.classList.add("open");
				body.style.display = "";
				void this._renderFiles(proj, body);
			}
		});

		addFileBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._handleAddFile(ws, proj);
		});
		renameBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._handleRenameProject(proj);
		});
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._handleDeleteProject(proj);
		});

		if (this._expanded.has(proj.id)) {
			await this._renderFiles(proj, body);
		}

		container.appendChild(row);
		container.appendChild(body);
		return container;
	}

	private async _renderFiles(proj: ProjectRecord, container: HTMLElement): Promise<void> {
		container.textContent = "";
		const files = await this._api.getFiles(proj.id);
		const currentId = this._api.getCurrentFileId();
		for (const file of files) {
			container.appendChild(this._buildFile(file, currentId));
		}
		if (files.length === 0) {
			const empty = mkEl("div", "bpmn-st-empty");
			empty.style.paddingLeft = "36px";
			empty.style.textAlign = "left";
			empty.textContent = "No files — click + above";
			container.appendChild(empty);
		}
	}

	private _buildFile(file: FileRecord, currentFileId: string | null): HTMLElement {
		const row = mkEl("div", "bpmn-st-row bpmn-st-file-row");
		if (file.id === currentFileId) row.classList.add("bpmn-st-active");

		const icon = mkEl("span", "bpmn-st-icon");
		icon.innerHTML = ICON_FILE;

		const name = mkEl("span", "bpmn-st-name");
		name.textContent = file.name;

		const typeTag = mkEl("span", "bpmn-st-type-tag");
		typeTag.textContent = `.${file.type}`;

		const actions = mkEl("div", "bpmn-st-actions");

		const shareBtn = mkBtn(
			"bpmn-st-action-btn",
			file.isShared ? "Unmark as shared" : "Mark as shared",
			file.isShared ? "★" : "☆",
		);
		shareBtn.style.color = file.isShared ? "var(--bpmn-accent, #0062ff)" : "";
		const renameBtn = mkBtn("bpmn-st-action-btn", "Rename", "✎");
		const deleteBtn = mkBtn("bpmn-st-action-btn", "Delete", "✕");
		actions.appendChild(shareBtn);
		actions.appendChild(renameBtn);
		actions.appendChild(deleteBtn);

		row.appendChild(icon);
		row.appendChild(name);
		row.appendChild(typeTag);
		row.appendChild(actions);

		row.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest(".bpmn-st-actions")) return;
			void this._api.openFile(file.id);
		});

		shareBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._api.setFileShared(file.id, !file.isShared);
		});
		renameBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._handleRenameFile(file);
		});
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this._handleDeleteFile(file);
		});

		return row;
	}

	// ─── CRUD handlers ────────────────────────────────────────────────────────

	private async _handleAddWorkspace(): Promise<void> {
		const name = window.prompt("Workspace name:");
		if (!name?.trim()) return;
		const ws = await this._api.createWorkspace(name.trim());
		this._expanded.add(ws.id);
		await this._render();
	}

	private async _handleRenameWorkspace(ws: WorkspaceRecord): Promise<void> {
		const name = window.prompt("New name:", ws.name);
		if (!name?.trim() || name.trim() === ws.name) return;
		await this._api.renameWorkspace(ws.id, name.trim());
	}

	private async _handleDeleteWorkspace(ws: WorkspaceRecord): Promise<void> {
		if (!window.confirm(`Delete workspace "${ws.name}" and all its projects and files?`)) return;
		await this._api.deleteWorkspace(ws.id);
	}

	private async _handleAddProject(ws: WorkspaceRecord): Promise<void> {
		const name = window.prompt("Project name:");
		if (!name?.trim()) return;
		const proj = await this._api.createProject(ws.id, name.trim());
		this._expanded.add(ws.id);
		this._expanded.add(proj.id);
		await this._render();
	}

	private async _handleRenameProject(proj: ProjectRecord): Promise<void> {
		const name = window.prompt("New name:", proj.name);
		if (!name?.trim() || name.trim() === proj.name) return;
		await this._api.renameProject(proj.id, name.trim());
	}

	private async _handleDeleteProject(proj: ProjectRecord): Promise<void> {
		if (!window.confirm(`Delete project "${proj.name}" and all its files?`)) return;
		await this._api.deleteProject(proj.id);
	}

	private async _handleAddFile(ws: WorkspaceRecord, proj: ProjectRecord): Promise<void> {
		const type = window.prompt("File type (bpmn / dmn / form):", "bpmn")?.trim().toLowerCase();
		if (type !== "bpmn" && type !== "dmn" && type !== "form") return;
		const defaultName = type === "bpmn" ? "Process" : type === "dmn" ? "Decision" : "Form";
		const name = window.prompt("File name:", defaultName);
		if (!name?.trim()) return;
		const content = _emptyTemplate(type);
		const file = await this._api.createFile(proj.id, ws.id, name.trim(), type, content);
		this._expanded.add(ws.id);
		this._expanded.add(proj.id);
		await this._render();
		void this._api.openFile(file.id);
	}

	private async _handleRenameFile(file: FileRecord): Promise<void> {
		const name = window.prompt("New name:", file.name);
		if (!name?.trim() || name.trim() === file.name) return;
		await this._api.renameFile(file.id, name.trim());
	}

	private async _handleDeleteFile(file: FileRecord): Promise<void> {
		if (!window.confirm(`Delete "${file.name}"?`)) return;
		await this._api.deleteFile(file.id);
	}
}

// ─── Empty file templates ─────────────────────────────────────────────────────

function _emptyTemplate(type: "bpmn" | "dmn" | "form"): string {
	if (type === "bpmn") {
		return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
	}
	if (type === "dmn") {
		return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  id="Definitions_1" name="Definitions_1" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="Decision_1" name="Decision 1">
    <decisionTable id="decisionTable_1"/>
  </decision>
</definitions>`;
	}
	return JSON.stringify({ id: "form_1", type: "default", components: [] });
}
