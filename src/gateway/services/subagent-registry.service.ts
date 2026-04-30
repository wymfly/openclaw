import {
  clearSubagentRunSteerRestart,
  getSubagentRunsForDeck,
  markSubagentRunForSteerRestart,
  markSubagentRunTerminated,
  replaceSubagentRunAfterSteer,
} from "../../agents/subagent-registry.js";
import type { SubagentRunRecord } from "../../agents/subagent-registry.types.js";

export type { SubagentRunRecord };

export interface SubagentRegistryService {
  readonly version: 1;
  readonly getSubagentRunsForDeck: typeof getSubagentRunsForDeck;
  readonly markSubagentRunTerminated: typeof markSubagentRunTerminated;
  readonly clearSubagentRunSteerRestart: typeof clearSubagentRunSteerRestart;
  readonly markSubagentRunForSteerRestart: typeof markSubagentRunForSteerRestart;
  readonly replaceSubagentRunAfterSteer: typeof replaceSubagentRunAfterSteer;
}

export function createSubagentRegistryService(): SubagentRegistryService {
  return {
    version: 1,
    getSubagentRunsForDeck,
    markSubagentRunTerminated,
    clearSubagentRunSteerRestart,
    markSubagentRunForSteerRestart,
    replaceSubagentRunAfterSteer,
  };
}

export const subagentRegistryService = createSubagentRegistryService();
