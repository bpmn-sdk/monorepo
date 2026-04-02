import type { WorkerJob } from "../worker.js"
import { interpolate } from "../worker.js"

export const JOB_TYPE_FETCH = "io.bpmnkit:email:fetch:1"
export const JOB_TYPE_SEND = "io.bpmnkit:email:send:1"

/**
 * Email fetch worker — connects via IMAP and retrieves messages.
 *
 * Task headers (all support {{secrets.X}} interpolation):
 *   imapHost, imapPort (default 993), imapUser, imapPassword, imapSecure (default "true")
 *   folder (default "INBOX"), limit (default 10), unreadOnly (default "true")
 *   resultVariable (default "emails")
 */
export async function handleFetch(job: WorkerJob): Promise<Record<string, unknown>> {
	const h = job.customHeaders
	const vars = job.variables

	const imapHost = interpolate(h.imapHost ?? "", vars)
	const imapPort = Number(interpolate(h.imapPort ?? "993", vars))
	const imapUser = interpolate(h.imapUser ?? "", vars)
	const imapPassword = interpolate(h.imapPassword ?? "", vars)
	const imapSecure = interpolate(h.imapSecure ?? "true", vars) !== "false"
	const folder = interpolate(h.folder ?? "INBOX", vars)
	const limit = Number(interpolate(h.limit ?? "10", vars))
	const unreadOnly = interpolate(h.unreadOnly ?? "true", vars) !== "false"
	const resultVariable = interpolate(h.resultVariable ?? "emails", vars)

	console.log(`[worker:email:fetch] folder=${folder} limit=${limit}`)

	const { ImapFlow } = await import("imapflow")

	const client = new ImapFlow({
		host: imapHost,
		port: imapPort,
		secure: imapSecure,
		auth: { user: imapUser, pass: imapPassword },
		logger: false,
	})

	await client.connect()

	const emails: Array<{
		uid: number
		subject: string
		from: string
		to: string
		date: string
		body: string
	}> = []

	try {
		const lock = await client.getMailboxLock(folder)
		try {
			const searchCriteria = unreadOnly ? { seen: false } : { all: true }
			const uidsResult = await client.search(searchCriteria, { uid: true })
			const uids = Array.isArray(uidsResult) ? uidsResult : []
			const fetchUids = uids.slice(-limit)

			if (fetchUids.length > 0) {
				for await (const msg of client.fetch(
					fetchUids,
					{ envelope: true, bodyParts: ["TEXT"] },
					{ uid: true },
				)) {
					const env = msg.envelope
					if (!env) continue
					const bodyPart = msg.bodyParts?.get("TEXT")
					const body = bodyPart ? Buffer.from(bodyPart).toString("utf-8") : ""

					emails.push({
						uid: msg.uid,
						subject: env.subject ?? "",
						from: env.from?.[0]?.address ?? "",
						to: env.to?.[0]?.address ?? "",
						date: env.date?.toISOString() ?? "",
						body,
					})
				}
			}
		} finally {
			lock.release()
		}
	} finally {
		await client.logout()
	}

	return { [resultVariable]: emails }
}

/**
 * Email send worker — sends a message via SMTP using nodemailer.
 *
 * Task headers (support interpolation):
 *   smtpHost, smtpPort (default 587), smtpUser, smtpPassword, smtpSecure (default "false")
 *   from (optional, defaults to smtpUser)
 *
 * Input variables (job.variables, headers as fallback):
 *   to, subject, body
 */
export async function handleSend(job: WorkerJob): Promise<Record<string, unknown>> {
	const h = job.customHeaders
	const vars = job.variables

	const smtpHost = interpolate(h.smtpHost ?? "", vars)
	const smtpPort = Number(interpolate(h.smtpPort ?? "587", vars))
	const smtpUser = interpolate(h.smtpUser ?? "", vars)
	const smtpPassword = interpolate(h.smtpPassword ?? "", vars)
	const smtpSecure = interpolate(h.smtpSecure ?? "false", vars) !== "false"
	const from = interpolate(h.from ?? smtpUser, vars)

	const to = String(vars.to ?? h.to ?? "")
	const subject = String(vars.subject ?? h.subject ?? "")
	const body = String(vars.body ?? h.body ?? "")

	console.log(`[worker:email:send] to=${to} subject=${subject}`)

	const nodemailer = await import("nodemailer")
	const transporter = nodemailer.createTransport({
		host: smtpHost,
		port: smtpPort,
		secure: smtpSecure,
		auth: { user: smtpUser, pass: smtpPassword },
	})

	await transporter.sendMail({ from, to, subject, text: body })

	return { sent: true, to, subject }
}
