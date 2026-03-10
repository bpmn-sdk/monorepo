#!/usr/bin/env node
/**
 * bench-layout — BPMN auto-layout benchmark
 *
 * Usage:  node scripts/bench-layout.mjs [folder] [options]
 *
 * Arguments:
 *   folder      Directory containing .bpmn files (default: ./bpmn-samples/)
 *
 * Options:
 *   --verbose   Print full element-by-element breakdown for each file
 *   --top N     Show top N deviating elements per file (default: 5)
 *
 * For each BPMN file the script:
 *   1. Parses the XML and reads reference positions from the DI section.
 *   2. Strips the DI data and runs the auto-layout engine.
 *   3. Compares both layouts and reports deviations.
 *
 * Actionable output helps identify where the auto-layout algorithm diverges
 * from hand-crafted or tool-generated diagrams, guiding improvements.
 */

import { readFileSync, readdirSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { benchmarkLayout } from "../packages/core/dist/index.js"

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const folderArg = args.find((a) => !a.startsWith("--"))
const verbose = args.includes("--verbose")
const topArg = args.indexOf("--top")
const topN = topArg !== -1 ? Number(args[topArg + 1] ?? 5) : 5

const folder = resolve(folderArg ?? "./bpmn-samples")

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEP = "═".repeat(72)
const sep = "─".repeat(72)

function printSep() {
	console.log(SEP)
}

function printLine() {
	console.log(sep)
}

function badge(condition) {
	return condition ? "✓" : "✗"
}

function fmtRatio(r) {
	const pct = Math.round((r - 1) * 100)
	if (pct === 0) return "same"
	return pct > 0 ? `+${pct}% larger` : `${pct}% smaller`
}

// ── File discovery ────────────────────────────────────────────────────────────

let files
try {
	files = readdirSync(folder)
		.filter((f) => f.endsWith(".bpmn"))
		.sort()
} catch {
	console.error(`Error: cannot read folder "${folder}"`)
	console.error("Create the folder and add .bpmn files, then re-run.")
	process.exit(1)
}

if (files.length === 0) {
	console.error(`No .bpmn files found in "${folder}"`)
	process.exit(1)
}

// ── Benchmark ─────────────────────────────────────────────────────────────────

printSep()
console.log("  bench-layout — BPMN Auto-Layout Benchmark")
console.log(`  Folder: ${folder}`)
console.log(`  Files:  ${files.length}`)
printSep()
console.log()

const results = []
let fileIndex = 0

for (const file of files) {
	fileIndex++
	const filePath = join(folder, file)
	const fileName = basename(file)

	console.log(`[${fileIndex}/${files.length}] ${fileName}`)

	let xml
	try {
		xml = readFileSync(filePath, "utf8")
	} catch (err) {
		console.log(`  ERROR reading file: ${err.message}`)
		console.log()
		continue
	}

	let result
	try {
		result = benchmarkLayout(xml, fileName)
	} catch (err) {
		console.log(`  ERROR during benchmark: ${err.message}`)
		if (verbose) console.error(err)
		console.log()
		continue
	}

	results.push(result)

	// ── Summary line ──────────────────────────────────────────────────────────
	console.log(
		`  Elements: ${result.elementCount}  Flows: ${result.flowCount}  Matched: ${result.matchedCount}/${result.elementCount}`,
	)
	console.log(
		`  Distance — avg: ${result.avgDistance.toFixed(1)}px  ` +
			`p90: ${result.p90Distance.toFixed(1)}px  max: ${result.maxDistance.toFixed(1)}px`,
	)
	console.log(
		`  Size — ref ${Math.round(result.ref.width)}×${Math.round(result.ref.height)}  ` +
			`auto ${Math.round(result.auto.width)}×${Math.round(result.auto.height)}  ` +
			`width ${fmtRatio(result.widthRatio)}  height ${fmtRatio(result.heightRatio)}`,
	)

	// ── Order violations ──────────────────────────────────────────────────────
	if (result.orderViolations.length > 0) {
		console.log(`  Order violations: ${result.orderViolations.length} ✗`)
		for (const v of result.orderViolations) {
			console.log(`    ✗ ${v.description}`)
		}
	} else {
		console.log("  Order violations: 0 ✓")
	}

	// ── Top deviating elements ────────────────────────────────────────────────
	const top = result.elements.slice(0, topN)
	if (top.length > 0) {
		console.log(`  Top ${top.length} deviations (by Euclidean distance):`)
		for (const el of top) {
			const label = el.name ? `"${el.name}"` : el.id
			const sign = (n) => (n >= 0 ? `+${Math.round(n)}` : String(Math.round(n)))
			const typeStr = `[${el.type}]`.padEnd(26)
			console.log(
				`    ${typeStr} ${label.slice(0, 28).padEnd(30)} ` +
					`Δx=${sign(el.delta.dx).padStart(6)} Δy=${sign(el.delta.dy).padStart(6)}  ` +
					`dist=${el.distance.toFixed(1)}px`,
			)
		}
	}

	// ── Verbose: full element list ────────────────────────────────────────────
	if (verbose && result.elements.length > topN) {
		console.log(`  Full element list (${result.elements.length} elements):`)
		for (const el of result.elements) {
			const label = el.name ? `"${el.name}"` : el.id
			const sign = (n) => (n >= 0 ? `+${Math.round(n)}` : String(Math.round(n)))
			console.log(
				`    [${el.type.padEnd(24)}] ${label.slice(0, 28).padEnd(30)} ` +
					`ref(${Math.round(el.ref.cx)},${Math.round(el.ref.cy)}) ` +
					`auto(${Math.round(el.auto.cx)},${Math.round(el.auto.cy)}) ` +
					`dist=${el.distance.toFixed(1)}px`,
			)
		}
	}

	console.log()
}

// ── Aggregate summary ─────────────────────────────────────────────────────────

if (results.length === 0) {
	console.log("No results to summarize.")
	process.exit(0)
}

printSep()
console.log("  SUMMARY")
printSep()

const totalElements = results.reduce((s, r) => s + r.elementCount, 0)
const totalFlows = results.reduce((s, r) => s + r.flowCount, 0)
const totalViolations = results.reduce((s, r) => s + r.orderViolations.length, 0)
const allAvgDistances = results.map((r) => r.avgDistance)
const globalAvgDist = allAvgDistances.reduce((s, d) => s + d, 0) / allAvgDistances.length
const allP90 = results.map((r) => r.p90Distance)
const globalP90 = allP90.reduce((s, d) => s + d, 0) / allP90.length

console.log(`  Files processed:    ${results.length} / ${files.length}`)
console.log(`  Total elements:     ${totalElements}`)
console.log(`  Total flows:        ${totalFlows}`)
console.log(`  Order violations:   ${totalViolations} ${badge(totalViolations === 0)}`)
console.log(`  Global avg dist:    ${globalAvgDist.toFixed(1)}px`)
console.log(`  Global P90 dist:    ${globalP90.toFixed(1)}px`)
console.log()

// Per-file scores sorted by avg distance descending (worst first)
const sorted = [...results].sort((a, b) => b.avgDistance - a.avgDistance)
console.log("  Files by avg deviation (worst first):")
for (const r of sorted) {
	const violations =
		r.orderViolations.length > 0 ? `  ${r.orderViolations.length} order violations ✗` : ""
	console.log(
		`    ${r.fileName.padEnd(40)} avg ${r.avgDistance.toFixed(1).padStart(7)}px  ` +
			`p90 ${r.p90Distance.toFixed(1).padStart(7)}px${violations}`,
	)
}

console.log()

// ── Guidance ──────────────────────────────────────────────────────────────────

printSep()
console.log("  INTERPRETATION GUIDE")
printSep()
console.log(`
  avg dist < 50px   Good match — minor positioning differences only.
  avg dist 50-150px  Moderate — spacing/alignment differences visible.
  avg dist > 150px   Large — structural layout differences, investigate.

  Order violations   Flow A→B where auto-layout reverses the X order.
                     Indicates wrong layer assignment for those elements.

  Width ratio > 1.5  Auto-layout is significantly wider than reference.
                     Investigate HORIZONTAL_SPACING or layer merging.

  Height ratio > 1.5 Auto-layout is taller than reference.
                     Investigate branch distribution or VERTICAL_SPACING.

  High Δx on elements  Layer assignment is off (elements in wrong column).
  High Δy on elements  Branch/baseline alignment is off.

  Run with --verbose for the full per-element breakdown.
`)
