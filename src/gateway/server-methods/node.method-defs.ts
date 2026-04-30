import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { nodeMethodDefs } from "./node-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "node",
  priority: 140,
  methodDefs: nodeMethodDefs,
};
