import type { MethodMetadata } from "../method-registry.js";
import { ADMIN_SCOPE } from "../method-scopes.js";
import {
  WizardCancelParamsSchema,
  WizardCancelResultSchema,
  WizardNextParamsSchema,
  WizardNextResultSchema,
  WizardStartParamsSchema,
  WizardStartResultSchema,
  WizardStatusParamsSchema,
  WizardStatusResultSchema,
} from "../protocol/schema/wizard.js";

export const wizardMethodDefs: Record<string, MethodMetadata> = {
  "wizard.start": {
    params: WizardStartParamsSchema,
    result: WizardStartResultSchema,
    scope: ADMIN_SCOPE,
  },
  "wizard.next": {
    params: WizardNextParamsSchema,
    result: WizardNextResultSchema,
    scope: ADMIN_SCOPE,
  },
  "wizard.cancel": {
    params: WizardCancelParamsSchema,
    result: WizardCancelResultSchema,
    scope: ADMIN_SCOPE,
  },
  "wizard.status": {
    params: WizardStatusParamsSchema,
    result: WizardStatusResultSchema,
    scope: ADMIN_SCOPE,
  },
};
