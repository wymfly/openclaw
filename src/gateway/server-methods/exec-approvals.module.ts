import type { GatewayMethodModule } from "../method-registry.js";
import { execApprovalsHandlers } from "./exec-approvals.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "exec-approvals",
  priority: 110,
  handlers: execApprovalsHandlers,
};
