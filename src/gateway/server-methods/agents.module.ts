import type { GatewayMethodModule } from "../method-registry.js";
import { agentsHandlers, agentsMethodDefs } from "./agents.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "agents",
  priority: 310,
  handlers: agentsHandlers,
  methodDefs: agentsMethodDefs,
};
