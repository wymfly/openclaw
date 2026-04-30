import {
  loadConfig,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
  writeConfigFile,
} from "../../config/config.js";

export type { AgentBinding, OpenClawConfig } from "../../config/types.js";

export interface ConfigService {
  readonly version: 1;
  readonly loadConfig: typeof loadConfig;
  readonly writeConfigFile: typeof writeConfigFile;
  readonly readConfigFileSnapshotForWrite: typeof readConfigFileSnapshotForWrite;
  readonly resolveConfigSnapshotHash: typeof resolveConfigSnapshotHash;
}

export function createConfigService(): ConfigService {
  return {
    version: 1,
    loadConfig,
    writeConfigFile,
    readConfigFileSnapshotForWrite,
    resolveConfigSnapshotHash,
  };
}

export const configService = createConfigService();
