import type { GatewayMethodModule } from "../method-registry.js";
import { ADMIN_SCOPE } from "../method-scopes.js";
import { updateHandlers } from "./update.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "update",
  priority: 240,
  handlers: updateHandlers,
  methodDefs: {
    "update.run": {
      scope: ADMIN_SCOPE,
      controlPlaneWrite: true,
    },
  },
};
