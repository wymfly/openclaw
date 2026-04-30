import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { agentsMethodDefs } from "./agents.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "agents",
  priority: 60,
  methodDefs: agentsMethodDefs,
};
