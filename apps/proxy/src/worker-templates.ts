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
	constraints?: { notEmpty?: boolean }
	binding: {
		type:
			| "zeebe:taskDefinition"
			| "zeebe:taskDefinition:type"
			| "zeebe:taskHeader"
			| "zeebe:input"
			| "zeebe:output"
			| "property"
		property?: "type" | "retries"
		key?: string
		name?: string
		source?: string
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
const WATCH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#1e1e2e"/><path d="M3 10V7l5-4 5 4v3" fill="none" stroke="#a78bfa" stroke-width="1.5"/><path d="M5 10h6v4H5z" fill="none" stroke="#a78bfa" stroke-width="1.5"/></svg>`
const HTTP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#1e1e2e"/><circle cx="8" cy="8" r="5" fill="none" stroke="#2dd4bf" stroke-width="1.5"/><path d="M3 8h10M8 3c-2 2-2 8 0 10M8 3c2 2 2 8 0 10" stroke="#2dd4bf" stroke-width="1" fill="none"/></svg>`
const EMAIL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#1e1e2e"/><rect x="2" y="4" width="12" height="8" rx="1" fill="none" stroke="#f59e0b" stroke-width="1.5"/><path d="M2 5l6 4 6-4" stroke="#f59e0b" stroke-width="1.5" fill="none"/></svg>`

export const WORKER_TEMPLATES: ElementTemplate[] = [
	// ── CLI Worker ────────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.cli",
		name: "CLI Command",
		version: 1,
		description:
			"Run any shell command. Use {{varName}} to interpolate process variables, {{secrets.NAME}} for secrets.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: CLI_ICON },
		groups: [
			{ id: "command", label: "Command" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:cli:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "command",
				label: "Command",
				description:
					"Shell command to run. Use {{varName}} for variables, {{secrets.NAME}} for secrets.",
				type: "Text",
				group: "command",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "command" },
			},
			{
				id: "cwd",
				label: "Working directory",
				description: "Directory to run the command in. Default: home directory (~).",
				type: "String",
				optional: true,
				group: "command",
				binding: { type: "zeebe:taskHeader", key: "cwd" },
			},
			{
				id: "timeout",
				label: "Timeout (seconds)",
				description: "Maximum time to wait before killing the process.",
				type: "Number",
				value: 60,
				group: "command",
				binding: { type: "zeebe:taskHeader", key: "timeout" },
			},
			{
				id: "ignoreExitCode",
				label: "Ignore non-zero exit code",
				description: "Complete the job even when the command exits with a non-zero code.",
				type: "Boolean",
				value: false,
				group: "command",
				binding: { type: "zeebe:taskHeader", key: "ignoreExitCode" },
			},
			{
				id: "resultVariable",
				label: "Result variable",
				description: "Process variable to store { stdout, stderr, exitCode }.",
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
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:llm:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "prompt",
				label: "Prompt",
				description:
					"The message to send. Use {{varName}} to include process variable values, or = for a FEEL expression.",
				type: "Text",
				feel: "optional",
				group: "prompt",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:input", name: "prompt" },
			},
			{
				id: "system",
				label: "System prompt",
				description: "Optional instruction given to the model before the user message.",
				type: "Text",
				optional: true,
				group: "prompt",
				binding: { type: "zeebe:taskHeader", key: "system" },
			},
			{
				id: "model",
				label: "Model",
				description: "Which LLM to use. Auto-detects the first available adapter if not set.",
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
				id: "resultVariable",
				label: "Result variable",
				description: "Process variable to store the model's response string.",
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
			{ id: "file", label: "File" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:fs:read:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "path",
				label: "File path",
				description: "Absolute path or ~/relative path. Use = for a FEEL expression.",
				type: "String",
				feel: "optional",
				group: "file",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:input", name: "path" },
			},
			{
				id: "resultVariable",
				label: "Result variable",
				description: "Process variable to store the file content (string).",
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
		groups: [{ id: "file", label: "File" }],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:fs:write:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "path",
				label: "File path",
				description: "Absolute path or ~/relative path to write. Use = for a FEEL expression.",
				type: "String",
				feel: "optional",
				group: "file",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:input", name: "path" },
			},
			{
				id: "content",
				label: "Content",
				description: "The string content to write. Use = for a FEEL expression.",
				type: "String",
				feel: "optional",
				group: "file",
				constraints: { notEmpty: true },
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
		groups: [{ id: "file", label: "File" }],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:fs:append:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "path",
				label: "File path",
				description: "Absolute path or ~/relative path to append to.",
				type: "String",
				feel: "optional",
				group: "file",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:input", name: "path" },
			},
			{
				id: "content",
				label: "Content",
				description: "The string content to append.",
				type: "String",
				feel: "optional",
				group: "file",
				constraints: { notEmpty: true },
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
			{ id: "directory", label: "Directory" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:fs:list:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "path",
				label: "Directory path",
				description: "Absolute path or ~/relative path to list.",
				type: "String",
				feel: "optional",
				group: "directory",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:input", name: "path" },
			},
			{
				id: "resultVariable",
				label: "Result variable",
				description: "Process variable to store the file list (string array).",
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
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:js:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "expression",
				label: "Expression",
				description:
					"JavaScript expression returning a value. Use `variables.x` to read process variables.",
				type: "Text",
				group: "expression",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "expression" },
			},
			{
				id: "resultVariable",
				label: "Result variable",
				description: "Process variable to store the expression result.",
				type: "String",
				value: "result",
				group: "output",
				binding: { type: "zeebe:taskHeader", key: "resultVariable" },
			},
		],
	},

	// ── File Watch Trigger ────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.trigger.file-watch",
		name: "File Watch Trigger",
		version: 1,
		description:
			"Watch a directory and start a process instance when files are created or changed.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: WATCH_ICON },
		groups: [
			{ id: "watch", label: "Watch" },
			{ id: "filter", label: "Filter" },
		],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:trigger:file-watch:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "watchPath",
				label: "Watch path",
				description: "Directory to watch for file changes. Absolute or ~/relative path.",
				type: "String",
				group: "watch",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "watchPath" },
			},
			{
				id: "events",
				label: "Events",
				description: "Which file system events trigger the process.",
				type: "Dropdown",
				value: "all",
				group: "watch",
				choices: [
					{ name: "Add or change (all)", value: "all" },
					{ name: "New files only (add)", value: "add" },
					{ name: "Modified files only (change)", value: "change" },
				],
				binding: { type: "zeebe:taskHeader", key: "events" },
			},
			{
				id: "glob",
				label: "File filter (glob)",
				description: "Only trigger for filenames matching this pattern (e.g. *.md, report_*.csv).",
				type: "String",
				optional: true,
				group: "filter",
				binding: { type: "zeebe:taskHeader", key: "glob" },
			},
		],
	},

	// ── HTTP Scraper ──────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.http.scrape",
		name: "HTTP Scraper",
		version: 1,
		description:
			"Fetch a URL and extract its text content and title. Returns { html, text, title, statusCode }.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: HTTP_ICON },
		groups: [
			{ id: "request", label: "Request" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:http:scrape:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "url",
				label: "URL",
				description: "URL to fetch. Use {{varName}} for variables or {{secrets.NAME}} for secrets.",
				type: "String",
				feel: "optional",
				group: "request",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "url" },
			},
			{
				id: "timeout",
				label: "Timeout (seconds)",
				description: "Maximum time to wait for the response.",
				type: "Number",
				value: 30,
				group: "request",
				binding: { type: "zeebe:taskHeader", key: "timeout" },
			},
			{
				id: "resultVariable",
				label: "Result variable",
				description: "Process variable to store { url, html, text, title, statusCode }.",
				type: "String",
				value: "scrapeResult",
				group: "output",
				binding: { type: "zeebe:taskHeader", key: "resultVariable" },
			},
		],
	},

	// ── Email Fetch ───────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.email.fetch",
		name: "Fetch Emails",
		version: 1,
		description:
			"Fetch emails from an IMAP mailbox. Returns an array of { uid, subject, from, date, body }.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: EMAIL_ICON },
		groups: [
			{ id: "connection", label: "Connection" },
			{ id: "filter", label: "Filter" },
			{ id: "output", label: "Output" },
		],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:email:fetch:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "imapHost",
				label: "IMAP host",
				description: "IMAP server hostname. Use {{secrets.IMAP_HOST}} for credentials.",
				type: "String",
				group: "connection",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "imapHost" },
			},
			{
				id: "imapPort",
				label: "IMAP port",
				type: "Number",
				value: 993,
				group: "connection",
				binding: { type: "zeebe:taskHeader", key: "imapPort" },
			},
			{
				id: "imapUser",
				label: "Username",
				description: "Use {{secrets.IMAP_USER}}.",
				type: "String",
				group: "connection",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "imapUser" },
			},
			{
				id: "imapPassword",
				label: "Password",
				description: "Use {{secrets.IMAP_PASSWORD}}.",
				type: "String",
				group: "connection",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "imapPassword" },
			},
			{
				id: "folder",
				label: "Folder",
				type: "String",
				value: "INBOX",
				group: "filter",
				binding: { type: "zeebe:taskHeader", key: "folder" },
			},
			{
				id: "limit",
				label: "Max messages",
				type: "Number",
				value: 10,
				group: "filter",
				binding: { type: "zeebe:taskHeader", key: "limit" },
			},
			{
				id: "unreadOnly",
				label: "Unread only",
				type: "Boolean",
				value: true,
				group: "filter",
				binding: { type: "zeebe:taskHeader", key: "unreadOnly" },
			},
			{
				id: "resultVariable",
				label: "Result variable",
				description: "Process variable to store the email array.",
				type: "String",
				value: "emails",
				group: "output",
				binding: { type: "zeebe:taskHeader", key: "resultVariable" },
			},
		],
	},

	// ── Email Send ────────────────────────────────────────────────────────────
	{
		id: "io.bpmnkit.email.send",
		name: "Send Email",
		version: 1,
		description: "Send an email via SMTP. Reads to/subject/body from process variables.",
		category: CATEGORY,
		appliesTo: ["bpmn:ServiceTask"],
		icon: { contents: EMAIL_ICON },
		groups: [
			{ id: "connection", label: "Connection" },
			{ id: "message", label: "Message" },
		],
		properties: [
			{
				id: "taskType",
				type: "Hidden",
				value: "io.bpmnkit:email:send:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				id: "smtpHost",
				label: "SMTP host",
				description: "SMTP server hostname. Use {{secrets.SMTP_HOST}}.",
				type: "String",
				group: "connection",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "smtpHost" },
			},
			{
				id: "smtpPort",
				label: "SMTP port",
				type: "Number",
				value: 587,
				group: "connection",
				binding: { type: "zeebe:taskHeader", key: "smtpPort" },
			},
			{
				id: "smtpUser",
				label: "Username",
				description: "Use {{secrets.SMTP_USER}}.",
				type: "String",
				group: "connection",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "smtpUser" },
			},
			{
				id: "smtpPassword",
				label: "Password",
				description: "Use {{secrets.SMTP_PASSWORD}}.",
				type: "String",
				group: "connection",
				constraints: { notEmpty: true },
				binding: { type: "zeebe:taskHeader", key: "smtpPassword" },
			},
			{
				id: "from",
				label: "From address",
				description: "Sender address. Defaults to SMTP username.",
				type: "String",
				optional: true,
				group: "message",
				binding: { type: "zeebe:taskHeader", key: "from" },
			},
		],
	},
]
