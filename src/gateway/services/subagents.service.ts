import { AGENT_LANE_SUBAGENT } from "../../agents/lanes.js";
import { abortEmbeddedPiRun } from "../../agents/pi-embedded.js";
import { killSubagentRunAdmin } from "../../agents/subagent-control.js";
import { clearSessionQueues } from "../../auto-reply/reply/queue.js";
import { callGateway } from "../../gateway/call.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../../utils/message-channel.js";

export interface SubagentsService {
  readonly version: 1;
  readonly abortEmbeddedPiRun: typeof abortEmbeddedPiRun;
  readonly clearSessionQueues: typeof clearSessionQueues;
  readonly callGateway: typeof callGateway;
  readonly killSubagentRunAdmin: typeof killSubagentRunAdmin;
  readonly AGENT_LANE_SUBAGENT: typeof AGENT_LANE_SUBAGENT;
  readonly INTERNAL_MESSAGE_CHANNEL: typeof INTERNAL_MESSAGE_CHANNEL;
}

export function createSubagentsService(): SubagentsService {
  return {
    version: 1,
    abortEmbeddedPiRun,
    clearSessionQueues,
    callGateway,
    killSubagentRunAdmin,
    AGENT_LANE_SUBAGENT,
    INTERNAL_MESSAGE_CHANNEL,
  };
}

export const subagentsService = createSubagentsService();
