import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { deviceMethodDefs } from "./device-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "device",
  priority: 130,
  methodDefs: deviceMethodDefs,
};
