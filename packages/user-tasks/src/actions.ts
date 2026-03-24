interface TaskActionOptions {
	proxyUrl: string
	profile: string | null
	taskKey: string
}

function buildHeaders(profile: string | null): Record<string, string> {
	const headers: Record<string, string> = {
		"content-type": "application/json",
		accept: "application/json",
	}
	if (profile) headers["x-profile"] = profile
	return headers
}

async function proxyPost(
	proxyUrl: string,
	path: string,
	profile: string | null,
	body?: unknown,
): Promise<void> {
	const res = await fetch(`${proxyUrl}${path}`, {
		method: "POST",
		headers: buildHeaders(profile),
		body: body !== undefined ? JSON.stringify(body) : undefined,
	})
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
	}
}

async function proxyDelete(proxyUrl: string, path: string, profile: string | null): Promise<void> {
	const res = await fetch(`${proxyUrl}${path}`, {
		method: "DELETE",
		headers: buildHeaders(profile),
	})
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
	}
}

export async function claimTask(options: TaskActionOptions, assignee: string): Promise<void> {
	return proxyPost(
		options.proxyUrl,
		`/api/user-tasks/${options.taskKey}/assignment`,
		options.profile,
		{ assignee },
	)
}

export async function unclaimTask(options: TaskActionOptions): Promise<void> {
	return proxyDelete(
		options.proxyUrl,
		`/api/user-tasks/${options.taskKey}/assignment`,
		options.profile,
	)
}

export async function completeTask(
	options: TaskActionOptions,
	variables: Record<string, unknown>,
): Promise<void> {
	return proxyPost(
		options.proxyUrl,
		`/api/user-tasks/${options.taskKey}/completion`,
		options.profile,
		{ variables },
	)
}

export async function fetchTaskForm(
	proxyUrl: string,
	profile: string | null,
	taskKey: string,
): Promise<unknown> {
	const headers: Record<string, string> = { accept: "application/json" }
	if (profile) headers["x-profile"] = profile
	const res = await fetch(`${proxyUrl}/api/user-tasks/${taskKey}/form`, { headers })
	if (!res.ok) throw new Error(`HTTP ${res.status}`)
	return res.json()
}
