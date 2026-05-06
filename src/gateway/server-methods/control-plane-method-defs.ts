import type { MethodMetadata } from "../method-registry.js";
import { ADMIN_SCOPE, APPROVALS_SCOPE, READ_SCOPE, WRITE_SCOPE } from "../method-scopes.js";
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
import {
  ChannelsLogoutParamsSchema,
  ChannelsStatusParamsSchema,
  ChannelsStatusResultSchema,
} from "../protocol/schema/channels.js";
import {
  DoctorMemoryDreamActionResultSchema,
  DoctorMemoryDreamDiaryResultSchema,
  ChannelsLogoutResultSchema,
  DoctorMemoryStatusResultSchema,
  HealthResultSchema,
  ModelsCatalogProvidersResultSchema,
  StatusResultSchema,
} from "../protocol/schema/control-plane-results.js";
import {
  CronAddResultSchema,
  CronListResultSchema,
  CronRemoveResultSchema,
  CronRunResultSchema,
  CronRunsResultSchema,
  CronStatusResultSchema,
  CronUpdateResultSchema,
} from "../protocol/schema/cron-extensions.js";
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
  ExecApprovalGetParamsSchema,
  ExecApprovalListParamsSchema,
  ExecApprovalListResultSchema,
  ExecApprovalRequestParamsSchema,
  ExecApprovalRequestResultSchema,
  ExecApprovalResolveParamsSchema,
  ExecApprovalResolveResultSchema,
  ExecApprovalWaitDecisionResultSchema,
  ExecApprovalsGetParamsSchema,
  ExecApprovalsNodeGetParamsSchema,
  ExecApprovalsNodeSetParamsSchema,
  ExecApprovalsSetParamsSchema,
  ExecApprovalsSnapshotSchema,
} from "../protocol/schema/exec-approvals.js";
import {
  PluginApprovalListParamsSchema,
  PluginApprovalListResultSchema,
  PluginApprovalRequestParamsSchema,
  PluginApprovalResolveParamsSchema,
  PluginApprovalResolveResultSchema,
} from "../protocol/schema/plugin-approvals.js";
import {
  UsageCostResultSchema,
  UsageStatusResultSchema,
} from "../protocol/schema/usage-result-schemas.js";

/**
 * Metadata for existing Gateway control-plane methods that Deck already
 * consumes but which historically were not part of Deck-facing methodDefs.
 *
 * This keeps the generated Deck allowlist sourced from method metadata rather
 * than a separately curated string list.
 */
export const controlPlaneMethodDefs: Record<string, MethodMetadata> = {
  "channels.status": {
    params: ChannelsStatusParamsSchema,
    result: ChannelsStatusResultSchema,
    scope: READ_SCOPE,
  },
  "channels.logout": {
    params: ChannelsLogoutParamsSchema,
    result: ChannelsLogoutResultSchema,
    scope: WRITE_SCOPE,
  },
  "doctor.memory.status": {
    result: DoctorMemoryStatusResultSchema,
    scope: READ_SCOPE,
  },
  health: {
    result: HealthResultSchema,
    scope: READ_SCOPE,
  },
  status: {
    result: StatusResultSchema,
    scope: READ_SCOPE,
  },
  "usage.status": {
    result: UsageStatusResultSchema,
    scope: READ_SCOPE,
  },
  "usage.cost": {
    result: UsageCostResultSchema,
    scope: READ_SCOPE,
  },
  "models.catalog.providers": {
    result: ModelsCatalogProvidersResultSchema,
    scope: READ_SCOPE,
    forkClass: "C4",
    bffEligible: false,
  },
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
  "cron.list": {
    params: CronListParamsSchema,
    result: CronListResultSchema,
    scope: READ_SCOPE,
  },
  "cron.status": {
    params: CronStatusParamsSchema,
    result: CronStatusResultSchema,
    scope: READ_SCOPE,
  },
  "cron.add": {
    params: CronAddParamsSchema,
    result: CronAddResultSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.update": {
    params: CronUpdateParamsSchema,
    result: CronUpdateResultSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.remove": {
    params: CronRemoveParamsSchema,
    result: CronRemoveResultSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.run": {
    params: CronRunParamsSchema,
    result: CronRunResultSchema,
    scope: ADMIN_SCOPE,
  },
  "cron.runs": {
    params: CronRunsParamsSchema,
    result: CronRunsResultSchema,
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
    result: ExecApprovalRequestResultSchema,
    scope: APPROVALS_SCOPE,
  },
  "exec.approval.resolve": {
    params: ExecApprovalResolveParamsSchema,
    result: ExecApprovalResolveResultSchema,
    scope: APPROVALS_SCOPE,
  },
  "exec.approval.waitDecision": {
    params: ExecApprovalGetParamsSchema,
    result: ExecApprovalWaitDecisionResultSchema,
    scope: APPROVALS_SCOPE,
  },
  "exec.approval.list": {
    params: ExecApprovalListParamsSchema,
    result: ExecApprovalListResultSchema,
    scope: APPROVALS_SCOPE,
  },
  // doctor.memory dream methods
  "doctor.memory.dreamDiary": {
    result: DoctorMemoryDreamDiaryResultSchema,
    scope: READ_SCOPE,
  },
  "doctor.memory.backfillDreamDiary": {
    result: DoctorMemoryDreamActionResultSchema,
    scope: WRITE_SCOPE,
  },
  "doctor.memory.resetDreamDiary": {
    result: DoctorMemoryDreamActionResultSchema,
    scope: WRITE_SCOPE,
  },
  "doctor.memory.resetGroundedShortTerm": {
    result: DoctorMemoryDreamActionResultSchema,
    scope: WRITE_SCOPE,
  },
  "doctor.memory.repairDreamingArtifacts": {
    result: DoctorMemoryDreamActionResultSchema,
    scope: WRITE_SCOPE,
  },
  "doctor.memory.dedupeDreamDiary": {
    result: DoctorMemoryDreamActionResultSchema,
    scope: WRITE_SCOPE,
  },
  // plugin.approval methods
  "plugin.approval.list": {
    params: PluginApprovalListParamsSchema,
    result: PluginApprovalListResultSchema,
    scope: APPROVALS_SCOPE,
  },
  "plugin.approval.request": {
    params: PluginApprovalRequestParamsSchema,
    result: undefined,
    scope: APPROVALS_SCOPE,
  },
  "plugin.approval.waitDecision": {
    params: undefined,
    result: undefined,
    scope: APPROVALS_SCOPE,
  },
  "plugin.approval.resolve": {
    params: PluginApprovalResolveParamsSchema,
    result: PluginApprovalResolveResultSchema,
    scope: APPROVALS_SCOPE,
  },
};
