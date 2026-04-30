import type { GatewayMethodModule } from "../method-registry.js";
import { doctorHandlers } from "./doctor.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "doctor",
  priority: 100,
  handlers: doctorHandlers,
};
