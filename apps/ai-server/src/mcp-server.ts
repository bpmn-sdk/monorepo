/**
 * Minimal stdio MCP server for BPMN diagram editing.
 * Zero external dependencies — pure Node.js built-ins + @bpmn-sdk/core (workspace package).
 *
 * Usage:
 *   node dist/mcp-server.js [--input <diagram.json>] [--output <result.json>]
 *
 * The server reads an initial CompactDiagram from --input (optional) and writes
 * the current state to --output after every mutating tool call.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import type { CompactDiagram, CompactElement, CompactFlow, CompactProcess } from "@bpmn-sdk/core";

// ── CLI args ──────────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag);
	return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const inputFile = getArg("--input");
const outputFile = getArg("--output");

// ── State ─────────────────────────────────────────────────────────────────────

let state: CompactDiagram = { id: "Definitions_1", processes: [] };

if (inputFile) {
	try {
		state = JSON.parse(readFileSync(inputFile, "utf8")) as CompactDiagram;
	} catch {
		/* start with empty diagram if file is unreadable */
	}
}

function saveState(): void {
	if (outputFile) writeFileSync(outputFile, JSON.stringify(state));
}

function findProcess(processId: string): CompactProcess | undefined {
	return state.processes.find((p) => p.id === processId);
}

function ensureProcess(processId: string): CompactProcess {
	let proc = state.processes.find((p) => p.id === processId);
	if (!proc) {
		proc = { id: processId, elements: [], flows: [] };
		state.processes.push(proc);
	}
	return proc;
}

// ── Tool definitions ──────────────────────────────────────────────────────────
//
// IMPORTANT: add_http_call is listed FIRST (after get_diagram) so the LLM
// encounters it before add_elements and uses it for any HTTP/REST task.

const ELEMENT_SCHEMA = {
	type: "object",
	properties: {
		id: { type: "string", description: "Unique element ID" },
		type: {
			type: "string",
			description:
				"BPMN element type. Events: startEvent | endEvent | intermediateThrowEvent | intermediateCatchEvent | boundaryEvent. " +
				"Tasks: serviceTask | userTask | businessRuleTask | callActivity | scriptTask | sendTask | manualTask. " +
				"Gateways: exclusiveGateway | parallelGateway | inclusiveGateway | eventBasedGateway. " +
				"Containers: subProcess | adHocSubProcess.",
		},
		name: { type: "string", description: "Display name shown on the diagram" },
		eventType: {
			type: "string",
			description:
				"For events: timer | message | signal | error | escalation | cancel | terminate | conditional | link | compensate",
		},
		attachedTo: { type: "string", description: "boundaryEvent only: ID of the host activity" },
		interrupting: {
			type: "boolean",
			description: "boundaryEvent only: false = non-interrupting (default true)",
		},
		jobType: {
			type: "string",
			description:
				"serviceTask only: Zeebe worker job type. " +
				"⚠️ For HTTP/REST API calls do NOT set this here — use the add_http_call tool instead.",
		},
		formId: { type: "string", description: "userTask only: linked Camunda form ID" },
		calledProcess: { type: "string", description: "callActivity only: ID of the called process" },
		decisionId: { type: "string", description: "businessRuleTask only: DMN decision ID" },
		resultVariable: {
			type: "string",
			description: "businessRuleTask / serviceTask: process variable to store the task output",
		},
	},
	required: ["id", "type"],
};

const FLOW_SCHEMA = {
	type: "object",
	properties: {
		id: { type: "string" },
		from: { type: "string", description: "Source element ID" },
		to: { type: "string", description: "Target element ID" },
		name: { type: "string" },
		condition: { type: "string", description: "FEEL condition expression" },
	},
	required: ["id", "from", "to"],
};

const TOOLS = [
	{
		name: "get_diagram",
		description: "Return the current BPMN diagram. Call this first before making any changes.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "add_http_call",
		description:
			"⚠️ ALWAYS use this tool — not add_elements — for any HTTP/REST API call, webhook, or external service integration.\n" +
			"Adds a Camunda HTTP connector service task (jobType: io.camunda:http-json:1) with the correct taskHeaders.\n" +
			"Use your knowledge of the target API to provide a real endpoint URL, not a placeholder.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				id: { type: "string", description: "Unique element ID" },
				name: { type: "string", description: "Task display name" },
				url: {
					type: "string",
					description:
						"Full API endpoint URL. Use your knowledge — e.g. https://api.github.com/repos/{owner}/{repo}/issues for GitHub.",
				},
				method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
				headers: {
					type: "string",
					description:
						'Optional JSON string of HTTP headers, e.g. {"Authorization":"Bearer {{token}}","Accept":"application/json"}',
				},
				body: {
					type: "string",
					description: "Optional FEEL expression for the request body (POST/PUT/PATCH)",
				},
				resultVariable: {
					type: "string",
					description: "Optional process variable name to store the HTTP response",
				},
			},
			required: ["processId", "id", "name", "url", "method"],
		},
	},
	{
		name: "add_elements",
		description:
			"Add BPMN elements (tasks, events, gateways) and/or sequence flows to a process.\n" +
			"⚠️ NOT for HTTP/REST API calls — use add_http_call for those.\n" +
			"Creates the process if it does not exist.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string", description: "Target process ID" },
				elements: {
					type: "array",
					items: ELEMENT_SCHEMA,
					description: "BPMN elements to add",
				},
				flows: {
					type: "array",
					items: FLOW_SCHEMA,
					description: "Sequence flows to add",
				},
			},
			required: ["processId"],
		},
	},
	{
		name: "remove_elements",
		description:
			"Remove BPMN elements and/or sequence flows. Removing an element also removes its connecting flows.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				elementIds: { type: "array", items: { type: "string" } },
				flowIds: { type: "array", items: { type: "string" } },
			},
			required: ["processId"],
		},
	},
	{
		name: "update_element",
		description:
			"Merge changes into an existing BPMN element (rename, change type, set jobType, etc.).",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				elementId: { type: "string" },
				changes: {
					...ELEMENT_SCHEMA,
					required: [],
					description: "Fields to update — only the provided fields are changed",
				},
			},
			required: ["processId", "elementId", "changes"],
		},
	},
	{
		name: "set_condition",
		description: "Set or clear a FEEL condition expression on a sequence flow.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				flowId: { type: "string" },
				condition: { description: "FEEL expression string, or null to remove the condition" },
			},
			required: ["processId", "flowId", "condition"],
		},
	},
	{
		name: "replace_diagram",
		description:
			"Replace the entire diagram. Use only when creating a new diagram from scratch or doing a full structural rewrite.",
		inputSchema: {
			type: "object",
			properties: {
				diagram: {
					type: "object",
					description:
						"Complete diagram object: { id, processes: [{ id, name?, elements: [...], flows: [...] }] }",
				},
			},
			required: ["diagram"],
		},
	},
];

// ── Tool execution ────────────────────────────────────────────────────────────

function callTool(name: string, args: Record<string, unknown>): string {
	process.stderr.write(`[mcp] tool: ${name} args: ${JSON.stringify(args)}\n`);
	switch (name) {
		case "get_diagram":
			return JSON.stringify(state, null, 2);

		case "add_elements": {
			const proc = ensureProcess(args.processId as string);
			const elements = (args.elements as CompactElement[] | undefined) ?? [];
			const flows = (args.flows as CompactFlow[] | undefined) ?? [];
			for (const el of elements) {
				if (!proc.elements.some((e) => e.id === el.id)) proc.elements.push(el);
			}
			for (const fl of flows) {
				if (!proc.flows.some((f) => f.id === fl.id)) proc.flows.push(fl);
			}
			saveState();
			return `Added ${elements.length} element(s) and ${flows.length} flow(s) to ${args.processId as string}.`;
		}

		case "remove_elements": {
			const proc = findProcess(args.processId as string);
			if (!proc) return `Process ${args.processId as string} not found.`;
			const dropEls = new Set((args.elementIds as string[] | undefined) ?? []);
			const dropFlows = new Set((args.flowIds as string[] | undefined) ?? []);
			const removedEls = proc.elements.filter((e) => dropEls.has(e.id)).length;
			proc.elements = proc.elements.filter((e) => !dropEls.has(e.id));
			const removedFlows = proc.flows.filter(
				(f) => dropFlows.has(f.id) || dropEls.has(f.from) || dropEls.has(f.to),
			).length;
			proc.flows = proc.flows.filter(
				(f) => !dropFlows.has(f.id) && !dropEls.has(f.from) && !dropEls.has(f.to),
			);
			saveState();
			return `Removed ${removedEls} element(s) and ${removedFlows} flow(s).`;
		}

		case "update_element": {
			const proc = findProcess(args.processId as string);
			if (!proc) return `Process ${args.processId as string} not found.`;
			const el = proc.elements.find((e) => e.id === (args.elementId as string));
			if (!el)
				return `Element ${args.elementId as string} not found in ${args.processId as string}.`;
			Object.assign(el, args.changes as Partial<CompactElement>);
			saveState();
			return `Updated element ${args.elementId as string}.`;
		}

		case "set_condition": {
			const proc = findProcess(args.processId as string);
			if (!proc) return `Process ${args.processId as string} not found.`;
			proc.flows = proc.flows.map((f): CompactFlow => {
				if (f.id !== (args.flowId as string)) return f;
				if (args.condition === null) {
					return { id: f.id, from: f.from, to: f.to, ...(f.name ? { name: f.name } : {}) };
				}
				return { ...f, condition: args.condition as string };
			});
			saveState();
			return `Condition set on flow ${args.flowId as string}.`;
		}

		case "add_http_call": {
			const proc = ensureProcess(args.processId as string);
			const taskHeaders: Record<string, string> = {
				url: args.url as string,
				method: args.method as string,
			};
			if (args.headers) taskHeaders.headers = args.headers as string;
			if (args.body) taskHeaders.body = args.body as string;
			const el: CompactElement = {
				id: args.id as string,
				type: "serviceTask",
				name: args.name as string,
				jobType: "io.camunda:http-json:1",
				taskHeaders,
			};
			if (args.resultVariable) el.resultVariable = args.resultVariable as string;
			if (!proc.elements.some((e) => e.id === el.id)) proc.elements.push(el);
			saveState();
			return `Added HTTP task "${args.name as string}" (${args.method as string} ${args.url as string}).`;
		}

		case "replace_diagram": {
			state = args.diagram as CompactDiagram;
			saveState();
			return "Diagram replaced.";
		}

		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}

// ── JSON-RPC 2.0 stdio loop ───────────────────────────────────────────────────

interface JsonRpcRequest {
	jsonrpc: string;
	id?: number | string;
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number | string | undefined;
	result?: unknown;
	error?: { code: number; message: string };
}

const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });

rl.on("line", (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;

	let req: JsonRpcRequest;
	try {
		req = JSON.parse(trimmed) as JsonRpcRequest;
	} catch {
		return;
	}

	// Notifications have no id — ignore them (no response needed)
	if (!("id" in req)) return;

	let result: unknown;
	let error: { code: number; message: string } | undefined;

	try {
		switch (req.method) {
			case "initialize":
				result = {
					protocolVersion: "2024-11-05",
					capabilities: { tools: {} },
					serverInfo: { name: "bpmn-mcp", version: "1.0.0" },
				};
				break;

			case "tools/list":
				result = { tools: TOOLS };
				break;

			case "tools/call": {
				const params = req.params as { name: string; arguments?: Record<string, unknown> };
				const text = callTool(params.name, params.arguments ?? {});
				result = { content: [{ type: "text", text }], isError: false };
				break;
			}

			case "ping":
				result = {};
				break;

			default:
				error = { code: -32601, message: "Method not found" };
		}
	} catch (err) {
		if (req.method === "tools/call") {
			result = { content: [{ type: "text", text: String(err) }], isError: true };
		} else {
			error = { code: -32603, message: String(err) };
		}
	}

	const response: JsonRpcResponse = error
		? { jsonrpc: "2.0", id: req.id, error }
		: { jsonrpc: "2.0", id: req.id, result };

	process.stdout.write(`${JSON.stringify(response)}\n`);
});
