import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { interpolate } from "../src/worker.js"
import { JOB_TYPE as CLI_JOB_TYPE, handle as cliHandle } from "../src/workers/cli.js"
import {
	JOB_TYPE_APPEND,
	JOB_TYPE_LIST,
	JOB_TYPE_READ,
	JOB_TYPE_WRITE,
	handleAppend,
	handleList,
	handleRead,
	handleWrite,
} from "../src/workers/fs.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJob(
	type: string,
	variables: Record<string, unknown> = {},
	customHeaders: Record<string, string> = {},
) {
	return {
		jobKey: "test-key",
		type,
		processInstanceKey: "pi-1",
		elementInstanceKey: "el-1",
		variables,
		customHeaders,
	}
}

// ── interpolate() ─────────────────────────────────────────────────────────────

describe("interpolate", () => {
	it("replaces a single variable", () => {
		expect(interpolate("hello {{name}}", { name: "world" })).toBe("hello world")
	})

	it("replaces multiple variables", () => {
		expect(interpolate("{{a}} + {{b}}", { a: "1", b: "2" })).toBe("1 + 2")
	})

	it("replaces repeated placeholder", () => {
		expect(interpolate("{{x}} {{x}}", { x: "hi" })).toBe("hi hi")
	})

	it("leaves unmatched placeholder unchanged", () => {
		expect(interpolate("{{missing}}", {})).toBe("{{missing}}")
	})

	it("reads secrets from process.env", () => {
		process.env.__TEST_SECRET_INTERP = "s3cr3t"
		try {
			expect(interpolate("key={{secrets.__TEST_SECRET_INTERP}}", {})).toBe("key=s3cr3t")
		} finally {
			process.env.__TEST_SECRET_INTERP = undefined
		}
	})

	it("leaves secret placeholder unchanged when env var is missing", () => {
		// biome-ignore lint/performance/noDelete: must fully remove the key for this test
		delete process.env.__NO_SUCH_SECRET_BPMNKIT
		expect(interpolate("{{secrets.__NO_SUCH_SECRET_BPMNKIT}}", {})).toBe(
			"{{secrets.__NO_SUCH_SECRET_BPMNKIT}}",
		)
	})
})

// ── CLI worker ────────────────────────────────────────────────────────────────

describe("CLI worker", () => {
	it("has correct job type", () => {
		expect(CLI_JOB_TYPE).toBe("io.bpmnkit:cli:1")
	})

	it("executes a command and returns stdout", async () => {
		const job = makeJob(CLI_JOB_TYPE, {}, { command: "echo hello" })
		const result = await cliHandle(job)
		expect((result.stdout as string).trim()).toBe("hello")
		expect(result.exitCode).toBe(0)
	})

	it("interpolates variables into the command", async () => {
		const job = makeJob(CLI_JOB_TYPE, { name: "world" }, { command: "echo {{name}}" })
		const result = await cliHandle(job)
		expect((result.stdout as string).trim()).toBe("world")
	})

	it("throws on non-zero exit code by default", async () => {
		const job = makeJob(CLI_JOB_TYPE, {}, { command: "exit 1" })
		await expect(cliHandle(job)).rejects.toThrow(/code 1/)
	})

	it("completes on non-zero exit when ignoreExitCode=true", async () => {
		const job = makeJob(CLI_JOB_TYPE, {}, { command: "exit 2", ignoreExitCode: "true" })
		const result = await cliHandle(job)
		expect(result.exitCode).toBe(2)
	})

	it("wraps output under resultVariable if set", async () => {
		const job = makeJob(CLI_JOB_TYPE, {}, { command: "echo hi", resultVariable: "out" })
		const result = await cliHandle(job)
		expect(result.out).toBeDefined()
		expect((result.out as Record<string, unknown>).exitCode).toBe(0)
	})

	it("throws when command header is missing", async () => {
		const job = makeJob(CLI_JOB_TYPE, {}, {})
		await expect(cliHandle(job)).rejects.toThrow(/command/)
	})
})

// ── FS workers ────────────────────────────────────────────────────────────────

describe("FS workers", () => {
	let tmpDir: string

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "bpmnkit-test-"))
	})

	afterEach(() => {
		rmSync(tmpDir, { recursive: true })
	})

	it("write then read round-trips content", async () => {
		const path = join(tmpDir, "hello.txt")

		const writeJob = makeJob(JOB_TYPE_WRITE, { path, content: "hello world" })
		const writeResult = await handleWrite(writeJob)
		expect(writeResult.bytesWritten).toBe(11)

		const readJob = makeJob(JOB_TYPE_READ, { path })
		const readResult = await handleRead(readJob)
		expect(readResult.content).toBe("hello world")
	})

	it("append adds to existing content", async () => {
		const path = join(tmpDir, "log.txt")

		await handleWrite(makeJob(JOB_TYPE_WRITE, { path, content: "line1\n" }))
		await handleAppend(makeJob(JOB_TYPE_APPEND, { path, content: "line2\n" }))

		const readResult = await handleRead(makeJob(JOB_TYPE_READ, { path }))
		expect(readResult.content).toBe("line1\nline2\n")
	})

	it("write creates parent directories", async () => {
		const path = join(tmpDir, "a", "b", "c.txt")
		await handleWrite(makeJob(JOB_TYPE_WRITE, { path, content: "deep" }))
		expect(readFileSync(path, "utf8")).toBe("deep")
	})

	it("list returns files in directory", async () => {
		mkdirSync(join(tmpDir, "sub"))
		const pathA = join(tmpDir, "a.txt")
		const pathB = join(tmpDir, "b.txt")
		await handleWrite(makeJob(JOB_TYPE_WRITE, { path: pathA, content: "" }))
		await handleWrite(makeJob(JOB_TYPE_WRITE, { path: pathB, content: "" }))

		const listResult = await handleList(makeJob(JOB_TYPE_LIST, { path: tmpDir }))
		const files = listResult.files as string[]
		expect(files).toContain("a.txt")
		expect(files).toContain("b.txt")
		expect(files).toContain("sub/")
	})

	it("read wraps under resultVariable if set", async () => {
		const path = join(tmpDir, "f.txt")
		await handleWrite(makeJob(JOB_TYPE_WRITE, { path, content: "data" }))

		const readJob = makeJob(JOB_TYPE_READ, { path }, { resultVariable: "myContent" })
		const result = await handleRead(readJob)
		expect(result.myContent).toBe("data")
	})

	it("read throws when path is missing", async () => {
		await expect(handleRead(makeJob(JOB_TYPE_READ, {}))).rejects.toThrow(/path/)
	})
})
