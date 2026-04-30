import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { controlPlaneMethodDefs } from "./control-plane-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "control-plane",
  priority: 30,
  methodDefs: controlPlaneMethodDefs,
};
