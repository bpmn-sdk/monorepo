/** FEEL token types for syntax highlighting. */
export type FeelTokenType =
	| "keyword"
	| "string"
	| "number"
	| "operator"
	| "range"
	| "function"
	| "comment"
	| "text";

export interface FeelToken {
	type: FeelTokenType;
	value: string;
}

const KEYWORDS = new Set([
	"true",
	"false",
	"null",
	"not",
	"and",
	"or",
	"if",
	"then",
	"else",
	"for",
	"in",
	"return",
	"every",
	"some",
	"satisfies",
	"instance",
	"of",
	"between",
	"function",
	"external",
	"context",
	"list",
	"date",
	"time",
	"duration",
]);

/**
 * Tokenizes a FEEL expression string into typed tokens for syntax highlighting.
 * Returns plain `[{type:"text",value}]` for empty/whitespace-only input.
 */
export function tokenizeFeel(input: string): FeelToken[] {
	if (!input.trim()) return [{ type: "text", value: input }];

	const tokens: FeelToken[] = [];
	let i = 0;

	const ch = (offset: number): string => input.charAt(i + offset);

	while (i < input.length) {
		// Date/time literal @"..."
		if (ch(0) === "@" && ch(1) === '"') {
			let end = i + 2;
			while (end < input.length && input.charAt(end) !== '"') {
				if (input.charAt(end) === "\\") end++;
				end++;
			}
			end++; // closing quote
			tokens.push({ type: "string", value: input.slice(i, end) });
			i = end;
			continue;
		}

		// String literal
		if (ch(0) === '"') {
			let end = i + 1;
			while (end < input.length && input.charAt(end) !== '"') {
				if (input.charAt(end) === "\\") end++;
				end++;
			}
			end++;
			tokens.push({ type: "string", value: input.slice(i, end) });
			i = end;
			continue;
		}

		// Range brackets
		if (ch(0) === "[" || ch(0) === "]" || ch(0) === "(" || ch(0) === ")") {
			tokens.push({ type: "range", value: ch(0) });
			i++;
			continue;
		}

		// Range operator ".."
		if (ch(0) === "." && ch(1) === ".") {
			tokens.push({ type: "operator", value: ".." });
			i += 2;
			continue;
		}

		// Two-char operators
		const twoChar = input.slice(i, i + 2);
		if (twoChar === ">=" || twoChar === "<=" || twoChar === "!=" || twoChar === "->") {
			tokens.push({ type: "operator", value: twoChar });
			i += 2;
			continue;
		}

		// Single-char operators
		if ("+-*/=><,;:".includes(ch(0))) {
			tokens.push({ type: "operator", value: ch(0) });
			i++;
			continue;
		}

		// Number (optional leading -)
		if ((ch(0) === "-" && /\d/.test(ch(1))) || /\d/.test(ch(0))) {
			let end = i;
			if (input.charAt(end) === "-") end++;
			while (end < input.length && /[\d.]/.test(input.charAt(end))) end++;
			tokens.push({ type: "number", value: input.slice(i, end) });
			i = end;
			continue;
		}

		// Identifier or keyword
		if (/[a-zA-Z_]/.test(ch(0))) {
			let end = i + 1;
			while (end < input.length && /[\w ]/.test(input.charAt(end))) {
				// multi-word FEEL names — stop at known delimiters
				if (input.charAt(end) === " " && !/[a-zA-Z_]/.test(input.charAt(end + 1))) break;
				end++;
			}
			const word = input.slice(i, end).trimEnd();
			const finalEnd = i + word.length;
			if (KEYWORDS.has(word)) {
				tokens.push({ type: "keyword", value: word });
			} else {
				tokens.push({ type: "text", value: word });
			}
			i = finalEnd;
			continue;
		}

		// Anything else (whitespace, punctuation)
		tokens.push({ type: "text", value: ch(0) });
		i++;
	}

	return tokens;
}

/** Renders FEEL tokens to an HTML string with `<span>` wrappers. */
export function highlightFeel(input: string): string {
	if (!input.trim()) return escapeHtml(input) || "<span class='feel-empty'>-</span>";
	const tokens = tokenizeFeel(input);
	return tokens
		.map((t) => {
			const escaped = escapeHtml(t.value);
			if (t.type === "text") return escaped;
			return `<span class="feel-${t.type}">${escaped}</span>`;
		})
		.join("");
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
