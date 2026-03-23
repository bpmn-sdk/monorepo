import type { TutorialManifest } from "../lib/types.js"
import { tutorial as errorHandling } from "./error-handling/index.js"
import { tutorial as gatewaysDecisions } from "./gateways-decisions/index.js"
import { tutorial as gettingStarted } from "./getting-started/index.js"
import { tutorial as inclusiveGateways } from "./inclusive-gateways/index.js"
import { tutorial as parallelWork } from "./parallel-work/index.js"
import { tutorial as serviceTasks } from "./service-tasks/index.js"
import { tutorial as subProcesses } from "./sub-processes/index.js"

export const tutorials: TutorialManifest[] = [
	gettingStarted,
	gatewaysDecisions,
	parallelWork,
	serviceTasks,
	errorHandling,
	inclusiveGateways,
	subProcesses,
]
export { gettingStarted }
