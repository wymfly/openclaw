import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { describeMethodDefs } from "./describe.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "describe",
  priority: 100,
  methodDefs: describeMethodDefs,
};
