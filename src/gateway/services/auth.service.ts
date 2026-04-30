import { buildAuthOverview } from "../../agents/auth-diagnostics.js";
import { runAuthProbes } from "../../commands/models/list.probe.js";
import type { AuthProbeResult } from "../../commands/models/list.probe.js";

export type { AuthProbeResult };

export interface AuthService {
  readonly version: 1;
  readonly buildAuthOverview: typeof buildAuthOverview;
  readonly runAuthProbes: typeof runAuthProbes;
}

export function createAuthService(): AuthService {
  return {
    version: 1,
    buildAuthOverview,
    runAuthProbes,
  };
}

export const authService = createAuthService();
