import type { Pattern } from "../types.js"

export const employeeOnboarding: Pattern = {
	id: "employee-onboarding",
	name: "Employee Onboarding",
	description: "HR workflow to provision accounts, complete paperwork, and orient new hires",
	keywords: [
		"onboarding",
		"employee",
		"hire",
		"new hire",
		"hr",
		"human resources",
		"provisioning",
		"orientation",
		"joiner",
		"staff",
	],
	readme: `## Employee Onboarding

End-to-end process that handles everything between a job offer acceptance and the
employee's first productive day.

### Key steps
1. **Account provisioning**: create accounts in identity provider, email, Slack, JIRA, etc.
2. **Equipment setup**: order/prepare hardware, software licenses, access badges
3. **Paperwork**: employment contract, tax forms, NDAs, direct deposit
4. **Orientation**: schedule sessions, assign buddy/mentor
5. **Access rights**: role-based access to systems and data

### Key considerations
- **Day-one readiness**: equipment and accounts must be ready before start date; model as parallel branches
- **Background checks**: may be async and take several days; use an intermediate catch event to wait
- **Country-specific compliance**: tax forms, work permits, GDPR consent vary by jurisdiction
- **IT security**: follow principle of least privilege; don't provision more access than the role requires
- **Offboarding mirror**: design with offboarding in mind — everything provisioned here must be revocable`,

	workers: [
		{
			name: "create-accounts",
			jobType: "com.example:accounts:provision:1",
			description: "Create user accounts in identity provider and core systems",
			inputs: {
				firstName: "string",
				lastName: "string",
				email: "string — corporate email address",
				department: "string",
				role: "string",
				startDate: "string (ISO 8601)",
			},
			outputs: {
				userId: "string — identity provider user ID",
				accountsCreated: "string[] — list of systems provisioned",
			},
			externalApis: ["Okta", "Azure AD / Entra ID", "Google Workspace", "JumpCloud"],
		},
		{
			name: "send-welcome-email",
			jobType: "io.bpmnkit:email:send:1",
			description: "Send welcome email with first-day instructions and account credentials",
			inputs: {
				to: "string — employee personal email",
				subject: "string",
				body: "string",
			},
			outputs: {},
		},
		{
			name: "create-jira-ticket",
			jobType: "com.example:jira:create-issue:1",
			description: "Create IT setup ticket for equipment procurement and configuration",
			inputs: {
				summary: "string",
				description: "string",
				assignee: "string — IT team member",
				dueDate: "string",
			},
			outputs: {
				ticketId: "string",
				ticketUrl: "string",
			},
			externalApis: ["Jira", "Linear", "ServiceNow", "Freshservice"],
		},
		{
			name: "schedule-orientation",
			jobType: "com.example:calendar:schedule:1",
			description: "Schedule orientation sessions in the company calendar",
			inputs: {
				attendees: "string[] — email addresses",
				startDate: "string",
				sessions: "string[] — session names to schedule",
			},
			outputs: {
				calendarEvents: "array of { title, startTime, meetingUrl }",
			},
			externalApis: ["Google Calendar", "Microsoft Outlook/Graph"],
		},
		{
			name: "notify-team",
			jobType: "com.example:slack:post:1",
			description: "Post new hire announcement to team Slack channel",
			inputs: {
				channel: "string",
				message: "string",
			},
			outputs: {},
			externalApis: ["Slack", "Microsoft Teams"],
		},
	],

	variations: `## Common variations

### Parallel provisioning
Account creation, equipment setup, and paperwork can be parallelised with a parallel
gateway. Use a joining parallel gateway before orientation to ensure all three branches
complete before scheduling.

### Background check hold
Add an intermediate timer catch event after offer acceptance to wait for background
check results before provisioning access to sensitive systems.

### Remote vs. on-site
For remote employees, replace equipment delivery with a stipend transfer and a
self-service setup guide. Add a separate flow for shipping hardware.

### Buddy/mentor assignment
Add a user task for the hiring manager to select a buddy, then a service task to
introduce them via email/Slack.`,

	template: {
		id: "employee-onboarding",
		processes: [
			{
				id: "Process_employeeOnboarding",
				name: "Employee Onboarding",
				elements: [
					{ id: "start", type: "startEvent", name: "Hire Confirmed", eventType: "message" },
					{
						id: "createAccounts",
						type: "serviceTask",
						name: "Create Accounts",
						jobType: "com.example:accounts:provision:1",
					},
					{ id: "parallelSplit", type: "parallelGateway", name: "" },
					{
						id: "sendWelcome",
						type: "serviceTask",
						name: "Send Welcome Email",
						jobType: "io.bpmnkit:email:send:1",
					},
					{
						id: "createITTicket",
						type: "serviceTask",
						name: "Create IT Setup Ticket",
						jobType: "com.example:jira:create-issue:1",
					},
					{ id: "completePayerwork", type: "userTask", name: "Complete Paperwork" },
					{ id: "parallelJoin", type: "parallelGateway", name: "" },
					{
						id: "scheduleOrientation",
						type: "serviceTask",
						name: "Schedule Orientation",
						jobType: "com.example:calendar:schedule:1",
					},
					{
						id: "notifyTeam",
						type: "serviceTask",
						name: "Notify Team",
						jobType: "com.example:slack:post:1",
					},
					{ id: "end", type: "endEvent", name: "Onboarding Complete" },
				],
				flows: [
					{ id: "f1", from: "start", to: "createAccounts" },
					{ id: "f2", from: "createAccounts", to: "parallelSplit" },
					{ id: "f3", from: "parallelSplit", to: "sendWelcome" },
					{ id: "f4", from: "parallelSplit", to: "createITTicket" },
					{ id: "f5", from: "parallelSplit", to: "completePayerwork" },
					{ id: "f6", from: "sendWelcome", to: "parallelJoin" },
					{ id: "f7", from: "createITTicket", to: "parallelJoin" },
					{ id: "f8", from: "completePayerwork", to: "parallelJoin" },
					{ id: "f9", from: "parallelJoin", to: "scheduleOrientation" },
					{ id: "f10", from: "scheduleOrientation", to: "notifyTeam" },
					{ id: "f11", from: "notifyTeam", to: "end" },
				],
			},
		],
	},
}
