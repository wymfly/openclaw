import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { agentMethodDefs } from "./agent.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "agent",
  priority: 50,
  methodDefs: agentMethodDefs,
};
