import type { MethodMetadata } from "../method-registry.js";
import { ADMIN_SCOPE, APPROVALS_SCOPE, READ_SCOPE } from "../method-scopes.js";
import {
  SkillsBinsParamsSchema,
  SkillsBinsResultSchema,
  SkillsInstallParamsSchema,
  SkillsStatusParamsSchema,
  SkillsUpdateParamsSchema,
} from "../protocol/schema/agents-models-skills.js";
import {
  CronAddParamsSchema,
  CronListParamsSchema,
  CronRemoveParamsSchema,
  CronRunParamsSchema,
  CronRunsParamsSchema,
  CronStatusParamsSchema,
  CronUpdateParamsSchema,
} from "../protocol/schema/cron.js";
import {
  ExecApprovalRequestParamsSchema,
  ExecApprovalResolveParamsSchema,
  ExecApprovalsGetParamsSchema,
  ExecApprovalsNodeGetParamsSchema,
  ExecApprovalsNodeSetParamsSchema,
  ExecApprovalsSetParamsSchema,
  ExecApprovalsSnapshotSchema,
} from "../protocol/schema/exec-approvals.js";

/**
 * Metadata for existing Gateway control-plane methods that Deck already
 * consumes but which historically were not part of Deck-facing methodDefs.
 *
 * This keeps the generated Deck allowlist sourced from method metadata rather
 * than a separately curated string list.
 */
export const controlPlaneMethodDefs: Record<string, MethodMetadata> = {
  "doctor.memory.status": {
    scope: READ_SCOPE,
  },
  health: {
    scope: READ_SCOPE,
  },
  status: {
    scope: READ_SCOPE,
  },
  "usage.status": {
    scope: READ_SCOPE,
  },
  "usage.cost": {
    scope: READ_SCOPE,
  },
  "models.catalog.providers": {
    scope: READ_SCOPE,
  },
  "skills.status": {
    params: SkillsStatusParamsSchema,
    scope: READ_SCOPE,
  },
  "skills.bins": {
    params: SkillsBinsParamsSchema,
    result: SkillsBinsResultSchema,
    scope: "node",
  },
  "skills.install": {
    params: SkillsInstallParamsSchema,
    scope: ADMIN_SCOPE,
  },
  "skills.update": {
    params: SkillsUpdateParamsSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.list": {
    params: CronListParamsSchema,
    scope: READ_SCOPE,
  },
  "cron.status": {
    params: CronStatusParamsSchema,
    scope: READ_SCOPE,
  },
  "cron.add": {
    params: CronAddParamsSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.update": {
    params: CronUpdateParamsSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.remove": {
    params: CronRemoveParamsSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.run": {
    params: CronRunParamsSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.runs": {
    params: CronRunsParamsSchema,
    scope: READ_SCOPE,
  },
  "exec.approvals.get": {
    params: ExecApprovalsGetParamsSchema,
    result: ExecApprovalsSnapshotSchema,
    scope: APPROVALS_SCOPE,
  },
  "exec.approvals.set": {
    params: ExecApprovalsSetParamsSchema,
    result: ExecApprovalsSnapshotSchema,
    scope: APPROVALS_SCOPE,
  },
  "exec.approvals.node.get": {
    params: ExecApprovalsNodeGetParamsSchema,
    result: ExecApprovalsSnapshotSchema,
    scope: APPROVALS_SCOPE,
  },
  "exec.approvals.node.set": {
    params: ExecApprovalsNodeSetParamsSchema,
    result: ExecApprovalsSnapshotSchema,
    scope: APPROVALS_SCOPE,
  },
  "exec.approval.request": {
    params: ExecApprovalRequestParamsSchema,
    scope: APPROVALS_SCOPE,
  },
  "exec.approval.resolve": {
    params: ExecApprovalResolveParamsSchema,
    scope: APPROVALS_SCOPE,
  },
};
