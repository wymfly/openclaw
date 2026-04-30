import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { sessionsMethodDefs } from "./sessions-method-defs.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "sessions",
  priority: 40,
  methodDefs: sessionsMethodDefs,
};
