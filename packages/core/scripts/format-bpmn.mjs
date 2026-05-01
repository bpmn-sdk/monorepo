#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join } from "node:path"
import { Bpmn } from "../dist/index.js"

const [, , inputPath] = process.argv
if (!inputPath) {
	console.error("Usage: format-bpmn <path/to/file.bpmn>")
	process.exit(1)
}

const xml = readFileSync(inputPath, "utf8")
const formatted = Bpmn.autoLayout(xml)

const ext = extname(inputPath)
const base = basename(inputPath, ext)
const outputPath = join(dirname(inputPath), `${base}-nf${ext}`)

writeFileSync(outputPath, formatted, "utf8")
console.log(outputPath)
