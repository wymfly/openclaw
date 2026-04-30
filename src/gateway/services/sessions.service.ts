import { resolveStateDir } from "../../config/paths.js";
import { loadSessionStore } from "../../config/sessions.js";
import {
  resolveSessionTranscriptsDirForAgent,
  resolveStorePath,
} from "../../config/sessions/paths.js";
import { loadJsonFile } from "../../infra/json-file.js";

export interface SessionsService {
  readonly version: 1;
  readonly loadSessionStore: typeof loadSessionStore;
  readonly resolveStorePath: typeof resolveStorePath;
  readonly resolveSessionTranscriptsDirForAgent: typeof resolveSessionTranscriptsDirForAgent;
  readonly resolveStateDir: typeof resolveStateDir;
  readonly loadJsonFile: typeof loadJsonFile;
}

export function createSessionsService(): SessionsService {
  return {
    version: 1,
    loadSessionStore,
    resolveStorePath,
    resolveSessionTranscriptsDirForAgent,
    resolveStateDir,
    loadJsonFile,
  };
}

export const sessionsService = createSessionsService();
