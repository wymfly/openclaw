import type { GatewayMethodModule } from "../method-registry.js";
import { describeHandlers, describeMethodDefs } from "./describe.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "describe",
  priority: 340,
  handlers: describeHandlers,
  methodDefs: describeMethodDefs,
};
