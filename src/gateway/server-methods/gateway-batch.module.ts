import type { GatewayMethodModule } from "../method-registry.js";
import { gatewayBatchHandlers } from "./gateway-batch.js";
import { gatewayBatchMethodDefs } from "./gateway-batch.method-defs.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "gateway-batch",
  priority: 340,
  handlers: gatewayBatchHandlers,
  methodDefs: gatewayBatchMethodDefs,
};
