import type { Pattern } from "../types.js"

export const contentModeration: Pattern = {
	id: "content-moderation",
	name: "Content Moderation",
	description:
		"Trust & safety workflow for reviewing user-generated content using AI and human review",
	keywords: [
		"moderation",
		"content",
		"trust and safety",
		"T&S",
		"UGC",
		"user-generated",
		"review",
		"flag",
		"ban",
		"spam",
		"NSFW",
		"harmful",
	],
	readme: `## Content Moderation

Two-tier pipeline (automated + human) that evaluates user-generated content for
policy violations before publishing.

### Content categories requiring moderation
- **CSAM**: zero-tolerance, immediate removal and reporting to NCMEC (legal obligation)
- **Hate speech**: context-dependent; platform policy defines thresholds
- **Violence/gore**: graphic content policies vary by platform
- **Spam/scam**: high volume; rule-based + ML classifiers
- **Misinformation**: harder to automate; often requires expert review
- **Copyright/IP**: DMCA takedown workflows (separate from standard moderation)

### Key considerations
- **Accuracy vs. latency**: AI models should err on the side of flagging; humans resolve edge cases
- **Moderator wellbeing**: exposure to harmful content requires support programs and rotation
- **Appeals process**: users should be able to appeal decisions
- **Audit trail**: all decisions must be logged with reason and moderator ID
- **Legal obligations**: CSAM, terrorist content, and some hate speech require mandatory reporting
- **DSA/DMA compliance** (EU): platforms >45M monthly users have additional transparency requirements

### Automation tiers
- **Tier 0 (blocklist)**: regex/hash match against known-bad content — immediate action
- **Tier 1 (AI scan)**: ML classifier for probability of violation — route on confidence
- **Tier 2 (human)**: trained moderator reviews flagged content and makes final decision`,

	workers: [
		{
			name: "ai-scan",
			jobType: "com.example:content:ai-scan:1",
			description: "ML-based content classification for policy violation probability",
			inputs: {
				contentType: "string — text | image | video | audio",
				contentUrl: "string — URL to content",
				contentText: "string — text content if applicable",
				userId: "string",
			},
			outputs: {
				violationProbability: "number — 0–1",
				categories: "array of { category, score }",
				recommendation: "string — approve | flag | remove",
				modelVersion: "string",
			},
			externalApis: [
				"AWS Rekognition",
				"Google Cloud Vision / Video Intelligence",
				"Azure Content Moderator",
				"OpenAI Moderation API",
				"Hive Moderation",
				"Clarifai",
			],
		},
		{
			name: "apply-action",
			jobType: "com.example:content:apply-action:1",
			description: "Apply moderation decision to content and user account",
			inputs: {
				contentId: "string",
				userId: "string",
				action: "string — approve | remove | shadow_ban | ban",
				reason: "string",
				moderatorId: "string",
			},
			outputs: {
				actionApplied: "boolean",
				userNotified: "boolean",
			},
		},
		{
			name: "report-csam",
			jobType: "com.example:content:report-csam:1",
			description: "Submit mandatory CSAM report to NCMEC CyberTipline",
			inputs: {
				contentId: "string",
				contentUrl: "string",
				userId: "string",
				ipAddress: "string",
				timestamp: "string",
			},
			outputs: {
				reportId: "string",
				submittedAt: "string",
			},
		},
		{
			name: "notify-user",
			jobType: "io.bpmnkit:email:send:1",
			description: "Notify user of content action and right to appeal",
			inputs: {
				to: "string",
				subject: "string",
				body: "string",
			},
			outputs: {},
		},
	],

	variations: `## Common variations

### Hash matching pre-check
Before AI scan, check content hash against PhotoDNA / CSAM hash database.
Immediate removal + reporting on match, no human review needed.

### Video/long content
For video content, run frame extraction first (service task) then pass sampled
frames to the AI scan. Long videos may need async processing with a message
catch event for the result.

### Appeal workflow
After a removal action, add a receive task to catch an appeal event. Route to
a senior moderator user task on appeal receipt.

### Queue prioritisation
Add a severity classification gateway before human review to prioritise CSAM
and violence ahead of spam and mild policy violations.`,

	template: {
		id: "content-moderation",
		processes: [
			{
				id: "Process_contentModeration",
				name: "Content Moderation",
				elements: [
					{ id: "start", type: "startEvent", name: "Content Submitted", eventType: "message" },
					{
						id: "aiScan",
						type: "serviceTask",
						name: "AI Content Scan",
						jobType: "com.example:content:ai-scan:1",
					},
					{ id: "csamGw", type: "exclusiveGateway", name: "CSAM?" },
					{
						id: "reportCsam",
						type: "serviceTask",
						name: "Report to NCMEC",
						jobType: "com.example:content:report-csam:1",
					},
					{ id: "riskGw", type: "exclusiveGateway", name: "Risk Level?" },
					{
						id: "autoApprove",
						type: "serviceTask",
						name: "Publish Content",
						jobType: "com.example:content:apply-action:1",
					},
					{ id: "humanReview", type: "userTask", name: "Human Review" },
					{ id: "decisionGw", type: "exclusiveGateway", name: "Decision?" },
					{
						id: "removeContent",
						type: "serviceTask",
						name: "Remove & Notify",
						jobType: "com.example:content:apply-action:1",
					},
					{
						id: "publishContent",
						type: "serviceTask",
						name: "Publish Content",
						jobType: "com.example:content:apply-action:1",
					},
					{ id: "end", type: "endEvent", name: "Moderation Complete" },
				],
				flows: [
					{ id: "f1", from: "start", to: "aiScan" },
					{ id: "f2", from: "aiScan", to: "csamGw" },
					{
						id: "f3",
						from: "csamGw",
						to: "reportCsam",
						name: "CSAM detected",
						condition: "= isCsam = true",
					},
					{ id: "f4", from: "csamGw", to: "riskGw", name: "No CSAM" },
					{ id: "f5", from: "reportCsam", to: "end" },
					{
						id: "f6",
						from: "riskGw",
						to: "autoApprove",
						name: "Low risk",
						condition: "= violationProbability < 0.3",
					},
					{
						id: "f7",
						from: "riskGw",
						to: "humanReview",
						name: "Flagged",
						condition: "= violationProbability >= 0.3",
					},
					{ id: "f8", from: "autoApprove", to: "end" },
					{ id: "f9", from: "humanReview", to: "decisionGw" },
					{
						id: "f10",
						from: "decisionGw",
						to: "publishContent",
						name: "Approved",
						condition: '= decision = "approve"',
					},
					{ id: "f11", from: "decisionGw", to: "removeContent", name: "Remove" },
					{ id: "f12", from: "publishContent", to: "end" },
					{ id: "f13", from: "removeContent", to: "end" },
				],
			},
		],
	},
}
