import type { MethodMetadata } from "../method-registry.js";
import { WRITE_SCOPE } from "../method-scopes.js";
import {
  SkillsInstallParamsSchema,
  SkillsInstallResultSchema,
} from "../protocol/schema/agents-models-skills.js";

export const skillsMethodDefs: Record<string, MethodMetadata> = {
  "skills.install": {
    params: SkillsInstallParamsSchema,
    result: SkillsInstallResultSchema,
    scope: WRITE_SCOPE,
  },
};
