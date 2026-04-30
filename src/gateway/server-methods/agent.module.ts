import type { GatewayMethodModule } from "../method-registry.js";
import { agentHandlers, agentMethodDefs } from "./agent.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "agent",
  priority: 300,
  handlers: agentHandlers,
  methodDefs: agentMethodDefs,
};
