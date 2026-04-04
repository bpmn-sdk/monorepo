import type { Pattern } from "../types.js"

export const incidentResponse: Pattern = {
	id: "incident-response",
	name: "Incident Response",
	description:
		"IT/ops workflow for detecting, triaging, resolving, and post-morteming service incidents",
	keywords: [
		"incident",
		"alert",
		"outage",
		"on-call",
		"escalation",
		"SRE",
		"ops",
		"devops",
		"monitoring",
		"pagerduty",
		"runbook",
		"post-mortem",
	],
	readme: `## Incident Response

Structured process for handling service incidents from detection through resolution
and post-mortem analysis.

### Severity levels (common convention)
- **SEV1**: complete outage, all users affected, immediate action required
- **SEV2**: major feature degraded, significant user impact
- **SEV3**: minor issue, workaround available
- **SEV4**: cosmetic or low-impact issue

### Key phases
1. **Detection**: alert fires from monitoring system
2. **Triage**: classify severity, assign incident commander
3. **Mobilisation**: page on-call, open incident channel, create ticket
4. **Investigation**: identify root cause, coordinate mitigation
5. **Resolution**: deploy fix or rollback, verify recovery
6. **Communication**: status page updates, customer notifications
7. **Post-mortem**: blameless review, action items

### Key considerations
- **Time-to-acknowledge (TTA)**: SEV1 target typically <5 minutes
- **Communication cadence**: update stakeholders every 30 minutes during active incident
- **Escalation paths**: if no acknowledgment within X minutes, page backup and manager
- **Runbooks**: link relevant runbooks at triage time to speed investigation
- **Blameless culture**: post-mortems focus on systems and processes, not individuals`,

	workers: [
		{
			name: "classify-incident",
			jobType: "io.bpmnkit:llm:1",
			description: "AI-assisted classification of incident severity and likely affected systems",
			inputs: {
				alertTitle: "string",
				alertBody: "string",
				metrics: "object — relevant metrics snapshot",
			},
			outputs: {
				severity: "string — SEV1 | SEV2 | SEV3 | SEV4",
				affectedSystems: "string[]",
				suggestedRunbook: "string (URL)",
				summary: "string",
			},
		},
		{
			name: "page-oncall",
			jobType: "com.example:pagerduty:trigger:1",
			description: "Trigger PagerDuty / Opsgenie alert to on-call engineer",
			inputs: {
				serviceId: "string",
				title: "string",
				severity: "string",
				body: "string",
			},
			outputs: {
				incidentId: "string",
				incidentUrl: "string",
				assignee: "string",
			},
			externalApis: ["PagerDuty", "Opsgenie", "VictorOps", "Splunk On-Call"],
		},
		{
			name: "create-incident-channel",
			jobType: "com.example:slack:create-channel:1",
			description: "Create a dedicated Slack incident channel and invite responders",
			inputs: {
				channelName: "string",
				invitees: "string[]",
				topic: "string",
			},
			outputs: {
				channelId: "string",
				channelUrl: "string",
			},
			externalApis: ["Slack", "Microsoft Teams"],
		},
		{
			name: "update-status-page",
			jobType: "com.example:statuspage:update:1",
			description: "Post incident update to public or internal status page",
			inputs: {
				status: "string — investigating | identified | monitoring | resolved",
				message: "string",
				affectedComponents: "string[]",
			},
			outputs: {
				incidentUrl: "string",
			},
			externalApis: ["Atlassian Statuspage", "Incident.io", "Freshstatus"],
		},
		{
			name: "create-postmortem",
			jobType: "com.example:notion:create-page:1",
			description: "Create post-mortem document from incident timeline and notes",
			inputs: {
				incidentId: "string",
				timeline: "array of { timestamp, description }",
				rootCause: "string",
				actionItems: "string[]",
			},
			outputs: {
				documentUrl: "string",
			},
			externalApis: ["Notion", "Confluence", "Google Docs", "Incident.io"],
		},
	],

	variations: `## Common variations

### Escalation timer
Add a non-interrupting timer boundary event on the "Acknowledge Incident" user task.
If not acknowledged within the SLA window, auto-escalate to the backup on-call and manager.

### Multi-team coordination
For cross-team incidents, spawn parallel sub-processes per team using a parallel gateway.
Each sub-process handles investigation for its service domain.

### Automated runbook execution
Replace the investigation user task with a service task that runs automated remediation
steps from the runbook (restart service, clear cache, scale up). Gate on success before
considering the incident resolved.

### Customer communication
Add a parallel notification path that sends email/SMS to affected enterprise customers
at key milestones (incident confirmed, fix deployed, resolved).`,

	template: {
		id: "incident-response",
		processes: [
			{
				id: "Process_incidentResponse",
				name: "Incident Response",
				elements: [
					{ id: "start", type: "startEvent", name: "Alert Fired", eventType: "message" },
					{
						id: "classify",
						type: "serviceTask",
						name: "Classify Incident",
						jobType: "io.bpmnkit:llm:1",
					},
					{ id: "severityGw", type: "exclusiveGateway", name: "Severity?" },
					{
						id: "pageOncall",
						type: "serviceTask",
						name: "Page On-Call",
						jobType: "com.example:pagerduty:trigger:1",
					},
					{
						id: "createChannel",
						type: "serviceTask",
						name: "Create Incident Channel",
						jobType: "com.example:slack:create-channel:1",
					},
					{
						id: "updateStatusPage",
						type: "serviceTask",
						name: "Update Status Page",
						jobType: "com.example:statuspage:update:1",
					},
					{ id: "investigate", type: "userTask", name: "Investigate & Mitigate" },
					{ id: "resolutionGw", type: "exclusiveGateway", name: "Resolved?" },
					{ id: "escalate", type: "userTask", name: "Escalate" },
					{
						id: "resolveStatusPage",
						type: "serviceTask",
						name: "Mark Resolved on Status Page",
						jobType: "com.example:statuspage:update:1",
					},
					{
						id: "createPostmortem",
						type: "serviceTask",
						name: "Create Post-Mortem",
						jobType: "com.example:notion:create-page:1",
					},
					{ id: "end", type: "endEvent", name: "Incident Resolved" },
					{ id: "endLow", type: "endEvent", name: "Ticket Created" },
				],
				flows: [
					{ id: "f1", from: "start", to: "classify" },
					{ id: "f2", from: "classify", to: "severityGw" },
					{
						id: "f3",
						from: "severityGw",
						to: "pageOncall",
						name: "SEV1/SEV2",
						condition: '= severity = "SEV1" or severity = "SEV2"',
					},
					{ id: "f4", from: "severityGw", to: "endLow", name: "SEV3/SEV4" },
					{ id: "f5", from: "pageOncall", to: "createChannel" },
					{ id: "f6", from: "createChannel", to: "updateStatusPage" },
					{ id: "f7", from: "updateStatusPage", to: "investigate" },
					{ id: "f8", from: "investigate", to: "resolutionGw" },
					{
						id: "f9",
						from: "resolutionGw",
						to: "resolveStatusPage",
						name: "Resolved",
						condition: '= status = "resolved"',
					},
					{ id: "f10", from: "resolutionGw", to: "escalate", name: "Escalate" },
					{ id: "f11", from: "escalate", to: "investigate" },
					{ id: "f12", from: "resolveStatusPage", to: "createPostmortem" },
					{ id: "f13", from: "createPostmortem", to: "end" },
				],
			},
		],
	},
}
