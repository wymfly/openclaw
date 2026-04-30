import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { configMethodDefs } from "./config-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "config",
  priority: 20,
  methodDefs: configMethodDefs,
};
