/**
 * Element template definitions for bpmnkit built-in workers.
 * Served via GET /worker-templates — consumed by the Studio connector catalog.
 *
 * Follows the Camunda element template schema so they are compatible with
 * the config-panel-bpmn template renderer.
 */

export interface TemplateProperty {
	id?: string
	label?: string
	description?: string
	type?: string
	value?: string | number | boolean
	optional?: boolean
	feel?: "optional" | "required" | "static"
	group?: string
	choices?: Array<{ name: string; value: string }>
	binding: {
		type:
			| "zeebe:taskDefinition:type"
			| "zeebe:taskHeader"
			| "zeebe:input"
			| "zeebe:output"
			| "property"
		key?: string
		name?: string
	}
	condition?: { property: string; equals: string }
}

export interface ElementTemplate {
	$schema?: string
	id: string
	name: string
	version: number
	description: string
	documentationRef?: string
	category: { id: string; name: string }
	appliesTo: string[]
	icon?: { contents: string }
	groups?: Array<{ id: string; label: string }>
	properties: TemplateProperty[]
}

const CATEGORY = { id: "bpmnkit", name: "Built-in" }

const CLI_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#1e1e2e"/><text x="3" y="12" font-family="monospace" font-size="10" fill="#cdd6f4">&gt;_</text></svg>`
const LLM_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#1e1e2e"/><circle cx="8" cy="8" r="5" fill="none" stroke="#6b9df7" stroke-width="1.5"/><path d="M6 8h4M8 6v4" stroke="#6b9df7" stroke-width="1.5"/></svg>`
const FS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#1e1e2e"/><path d="M3 5h10v8H3z" fill="none" stroke="#2dd4bf" stroke-width="1.5"/><path d="M3 5l2-2h4l2 2" fill="none" stroke="#2dd4bf" stroke-width="1.5"/></svg>`
const JS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#f59e0b"/><text x="2" y="12" font-family="monospace" font-size="9" font-weight="bold" fill="#1e1e2e">JS</text></svg>`

export const WORKER_TEMPLATES: ElementTemplate[] = [
	// ── CLI Worker ────────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.cli",
		name: "CLI Command",
		version: 1,
		description:
			"Run any shell command. Use {{varName}} in the command to interpolate process variables.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: CLI_ICON },
		groups: [
			{ id: "command", label: "Command" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				type: "Hidden",
				binding: { type: "zeebe:taskDefinition:type" },
				value: "io.bpmnkit:cli:1",
			},
			{
				label: "Command",
				description:
					"Shell command to execute. Use {{varName}} for variable interpolation and {{secrets.NAME}} for secrets.",
				type: "Text",
				group: "command",
				binding: { type: "zeebe:taskHeader", key: "command" },
			},
			{
				label: "Working directory",
				description: "Directory to run the command in. Default: home directory.",
				type: "String",
				optional: true,
				group: "command",
				binding: { type: "zeebe:taskHeader", key: "cwd" },
			},
			{
				label: "Timeout (seconds)",
				description: "Maximum time to wait for the command to finish.",
				type: "Number",
				value: 60,
				group: "command",
				binding: { type: "zeebe:taskHeader", key: "timeout" },
			},
			{
				label: "Ignore non-zero exit code",
				type: "Boolean",
				value: false,
				group: "command",
				binding: { type: "zeebe:taskHeader", key: "ignoreExitCode" },
			},
			{
				label: "Result variable",
				description: "Output variable name. Receives { stdout, stderr, exitCode }.",
				type: "String",
				value: "cliResult",
				group: "output",
				binding: { type: "zeebe:taskHeader", key: "resultVariable" },
			},
		],
	},

	// ── LLM Worker ───────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.llm",
		name: "LLM Prompt",
		version: 1,
		description: "Call an AI model (Claude, Copilot, or Gemini) with a prompt.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: LLM_ICON },
		groups: [
			{ id: "prompt", label: "Prompt" },
			{ id: "model", label: "Model" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				type: "Hidden",
				binding: { type: "zeebe:taskDefinition:type" },
				value: "io.bpmnkit:llm:1",
			},
			{
				label: "Prompt",
				description: "The prompt to send. Use {{varName}} to include process variable values.",
				type: "Text",
				feel: "optional",
				group: "prompt",
				binding: { type: "zeebe:input", name: "prompt" },
			},
			{
				label: "System prompt",
				description: "Optional instruction given to the model before the user message.",
				type: "Text",
				optional: true,
				group: "prompt",
				binding: { type: "zeebe:taskHeader", key: "system" },
			},
			{
				label: "Model",
				description: "Which LLM to use. Auto-detects the first available if not set.",
				type: "Dropdown",
				optional: true,
				group: "model",
				choices: [
					{ name: "Auto-detect", value: "" },
					{ name: "Claude", value: "claude" },
					{ name: "GitHub Copilot", value: "copilot" },
					{ name: "Gemini", value: "gemini" },
				],
				binding: { type: "zeebe:taskHeader", key: "model" },
			},
			{
				label: "Result variable",
				description: "Variable name to store the model response.",
				type: "String",
				value: "response",
				group: "output",
				binding: { type: "zeebe:taskHeader", key: "resultVariable" },
			},
		],
	},

	// ── FS Read ───────────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.fs.read",
		name: "Read File",
		version: 1,
		description: "Read a file from the local filesystem into a process variable.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: FS_ICON },
		groups: [
			{ id: "input", label: "File" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				type: "Hidden",
				binding: { type: "zeebe:taskDefinition:type" },
				value: "io.bpmnkit:fs:read:1",
			},
			{
				label: "File path",
				description: "Absolute or ~/relative path to the file.",
				type: "String",
				feel: "optional",
				group: "input",
				binding: { type: "zeebe:input", name: "path" },
			},
			{
				label: "Result variable",
				description: "Variable name to store the file content string.",
				type: "String",
				value: "fileContent",
				group: "output",
				binding: { type: "zeebe:taskHeader", key: "resultVariable" },
			},
		],
	},

	// ── FS Write ──────────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.fs.write",
		name: "Write File",
		version: 1,
		description:
			"Write a process variable to a file. Parent directories are created automatically.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: FS_ICON },
		groups: [{ id: "input", label: "File" }],
		properties: [
			{
				type: "Hidden",
				binding: { type: "zeebe:taskDefinition:type" },
				value: "io.bpmnkit:fs:write:1",
			},
			{
				label: "File path",
				description: "Absolute or ~/relative path to write.",
				type: "String",
				feel: "optional",
				group: "input",
				binding: { type: "zeebe:input", name: "path" },
			},
			{
				label: "Content",
				description: "The string content to write.",
				type: "String",
				feel: "optional",
				group: "input",
				binding: { type: "zeebe:input", name: "content" },
			},
		],
	},

	// ── FS Append ─────────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.fs.append",
		name: "Append to File",
		version: 1,
		description: "Append content to a file. Creates the file if it does not exist.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: FS_ICON },
		groups: [{ id: "input", label: "File" }],
		properties: [
			{
				type: "Hidden",
				binding: { type: "zeebe:taskDefinition:type" },
				value: "io.bpmnkit:fs:append:1",
			},
			{
				label: "File path",
				type: "String",
				feel: "optional",
				group: "input",
				binding: { type: "zeebe:input", name: "path" },
			},
			{
				label: "Content",
				type: "String",
				feel: "optional",
				group: "input",
				binding: { type: "zeebe:input", name: "content" },
			},
		],
	},

	// ── FS List ───────────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.fs.list",
		name: "List Directory",
		version: 1,
		description: "List files in a directory. Returns an array of filenames.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: FS_ICON },
		groups: [
			{ id: "input", label: "Directory" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				type: "Hidden",
				binding: { type: "zeebe:taskDefinition:type" },
				value: "io.bpmnkit:fs:list:1",
			},
			{
				label: "Directory path",
				type: "String",
				feel: "optional",
				group: "input",
				binding: { type: "zeebe:input", name: "path" },
			},
			{
				label: "Result variable",
				description: "Variable to store the file list array.",
				type: "String",
				value: "files",
				group: "output",
				binding: { type: "zeebe:taskHeader", key: "resultVariable" },
			},
		],
	},

	// ── JS Eval ───────────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.js",
		name: "JavaScript Expression",
		version: 1,
		description:
			"Evaluate a JavaScript expression. All process variables are available via the `variables` object.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: JS_ICON },
		groups: [
			{ id: "expression", label: "Expression" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				type: "Hidden",
				binding: { type: "zeebe:taskDefinition:type" },
				value: "io.bpmnkit:js:1",
			},
			{
				label: "Expression",
				description: "JavaScript expression. Use `variables.x` to access process variables.",
				type: "Text",
				group: "expression",
				binding: { type: "zeebe:taskHeader", key: "expression" },
			},
			{
				label: "Result variable",
				description: "Variable name to store the expression result.",
				type: "String",
				value: "result",
				group: "output",
				binding: { type: "zeebe:taskHeader", key: "resultVariable" },
			},
		],
	},
]
