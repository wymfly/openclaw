export { checkClosure } from "./checker.js";
export {
  ClosureBootstrapError,
  loadClosureConfig,
  resolvePlanFiles,
  resolveVerificationPath,
} from "./config.js";
export { collectPlanCoverage, parsePlanCoverage } from "./plan-coverage.js";
export { createClosureProgram, runClosureCommandLine } from "./program.js";
export { formatClosureReport } from "./report.js";
export { collectScenarioInventory } from "./spec-inventory.js";
export {
  createVerificationArtifact,
  readVerificationArtifact,
  writeVerificationArtifact,
} from "./verification-artifact.js";
export type * from "./types.js";
