import type { MethodMetadata } from "../method-registry.js";
import { ADMIN_SCOPE, READ_SCOPE } from "../method-scopes.js";
import {
  SkillsBinsParamsSchema,
  SkillsBinsResultSchema,
  SkillsDetailParamsSchema,
  SkillsDetailResultSchema,
  SkillsInstallParamsSchema,
  SkillsInstallResultSchema,
  SkillsSearchParamsSchema,
  SkillsSearchResultSchema,
  SkillsStatusParamsSchema,
  SkillsStatusResultSchema,
  SkillsUpdateParamsSchema,
  SkillsUpdateResultSchema,
} from "../protocol/schema/agents-models-skills.js";

export const skillsMethodDefs: Record<string, MethodMetadata> = {
  "skills.status": {
    params: SkillsStatusParamsSchema,
    result: SkillsStatusResultSchema,
    scope: READ_SCOPE,
  },
  "skills.bins": {
    params: SkillsBinsParamsSchema,
    result: SkillsBinsResultSchema,
    scope: "node",
  },
  "skills.search": {
    params: SkillsSearchParamsSchema,
    result: SkillsSearchResultSchema,
    scope: READ_SCOPE,
  },
  "skills.detail": {
    params: SkillsDetailParamsSchema,
    result: SkillsDetailResultSchema,
    scope: READ_SCOPE,
  },
  "skills.install": {
    params: SkillsInstallParamsSchema,
    result: SkillsInstallResultSchema,
    scope: ADMIN_SCOPE,
  },
  "skills.update": {
    params: SkillsUpdateParamsSchema,
    result: SkillsUpdateResultSchema,
    scope: ADMIN_SCOPE,
  },
};
