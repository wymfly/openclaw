import { buildPluginSnapshotReport } from "../../plugins/status.js";

export interface PluginsService {
  readonly version: 1;
  readonly buildPluginSnapshotReport: typeof buildPluginSnapshotReport;
}

export function createPluginsService(): PluginsService {
  return {
    version: 1,
    buildPluginSnapshotReport,
  };
}

export const pluginsService = createPluginsService();
