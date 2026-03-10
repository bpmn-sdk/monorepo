import { createOperate } from "@bpmn-sdk/operate"

const container = document.getElementById("operate-container")
if (container) {
	createOperate({
		container,
		mock: true,
		theme: "auto",
		pollInterval: 10_000,
	})
}
