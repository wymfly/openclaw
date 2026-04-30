import type { GatewayMethodModule } from "../method-registry.js";
import { nodePendingHandlers } from "./nodes-pending.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "nodes-pending",
  priority: 260,
  handlers: nodePendingHandlers,
};
