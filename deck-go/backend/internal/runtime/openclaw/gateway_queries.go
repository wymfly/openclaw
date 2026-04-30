package openclaw

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

type GatewayQueries struct {
	requester Requester
	typed     *generated.TypedClient
}

func NewGatewayQueries(requester Requester) *GatewayQueries {
	return &GatewayQueries{
		requester: requester,
		typed:     generated.NewTypedClient(requester),
	}
}

func (q *GatewayQueries) RequestTypedRaw(ctx context.Context, method string, params any) (any, error) {
	return q.requester.RequestTyped(ctx, method, params)
}

func (q *GatewayQueries) BridgeFrame(ctx context.Context, raw []byte, idPrefix string) ([]byte, error) {
	bridge, ok := q.requester.(interface {
		BridgeFrame(context.Context, []byte, string) ([]byte, error)
	})
	if !ok {
		return nil, errors.New("gateway frame bridge is unavailable")
	}
	return bridge.BridgeFrame(ctx, raw, idPrefix)
}

func (q *GatewayQueries) Batch(ctx context.Context, params generated.GatewayBatchParams) (generated.GatewayBatchResult, error) {
	return q.typed.Batch(ctx, params)
}

func (q *GatewayQueries) Describe(ctx context.Context, includeSchemas bool) (generated.GatewayDescribeResult, error) {
	return q.typed.GatewayDescribe(ctx, generated.GatewayDescribeParams{
		Filter:         "all",
		IncludeSchemas: includeSchemas,
	})
}

func (q *GatewayQueries) Health(ctx context.Context) (generated.HealthResult, error) {
	return q.typed.Health(ctx, map[string]any{})
}

func (q *GatewayQueries) HealthWithParams(ctx context.Context, params map[string]any) (generated.HealthResult, error) {
	return q.typed.Health(ctx, params)
}

func (q *GatewayQueries) Status(ctx context.Context) (generated.StatusResult, error) {
	return q.typed.Status(ctx, map[string]any{})
}

func (q *GatewayQueries) ConfigSchemaLookup(ctx context.Context, path string) (generated.ConfigSchemaLookupResult, error) {
	return q.typed.ConfigSchemaLookup(ctx, generated.ConfigSchemaLookupParams{Path: path})
}

func (q *GatewayQueries) ConfigSchema(ctx context.Context) (generated.ConfigSchemaResult, error) {
	return q.typed.ConfigSchema(ctx, generated.ConfigSchemaParams{})
}

func (q *GatewayQueries) ConfigGet(ctx context.Context) (generated.ConfigGetResult, error) {
	return q.typed.ConfigGet(ctx, generated.ConfigGetParams{})
}

func (q *GatewayQueries) ConfigGetWithParams(ctx context.Context, params map[string]any) (generated.ConfigGetResult, error) {
	return q.typed.ConfigGet(ctx, params)
}

func (q *GatewayQueries) ConfigPatch(ctx context.Context, raw string, baseHash string, note string) (generated.ConfigPatchResult, error) {
	return q.typed.ConfigPatch(ctx, generated.ConfigPatchParams{
		Raw:      raw,
		BaseHash: baseHash,
		Note:     note,
	})
}

func (q *GatewayQueries) ConfigApply(ctx context.Context, raw string, baseHash string) (generated.ConfigApplyResult, error) {
	return q.typed.ConfigApply(ctx, generated.ConfigApplyParams{
		Raw:      raw,
		BaseHash: baseHash,
	})
}

func (q *GatewayQueries) AgentsList(ctx context.Context) (generated.AgentsListResult, error) {
	return q.typed.AgentsList(ctx, generated.AgentsListParams{})
}

func (q *GatewayQueries) AgentIdentityGet(ctx context.Context, agentID string) (generated.AgentIdentityGetResult, error) {
	return q.typed.AgentIdentityGet(ctx, generated.AgentIdentityGetParams{AgentId: agentID})
}

func (q *GatewayQueries) AgentsCreate(ctx context.Context, params map[string]any) (generated.AgentsCreateResult, error) {
	typedParams, err := typedParamsFromMap[generated.AgentsCreateParams](params)
	if err != nil {
		return generated.AgentsCreateResult{}, err
	}
	return q.typed.AgentsCreate(ctx, typedParams)
}

func (q *GatewayQueries) AgentsDelete(ctx context.Context, agentID string) (generated.AgentsDeleteResult, error) {
	return q.typed.AgentsDelete(ctx, generated.AgentsDeleteParams{AgentId: agentID})
}

func (q *GatewayQueries) AgentsUpdate(ctx context.Context, body map[string]any) (generated.AgentsUpdateResult, error) {
	params, err := typedParamsFromMap[generated.AgentsUpdateParams](body)
	if err != nil {
		return generated.AgentsUpdateResult{}, err
	}
	return q.typed.AgentsUpdate(ctx, params)
}

func (q *GatewayQueries) AgentFilesList(ctx context.Context, agentID string) (generated.AgentsFilesListResult, error) {
	return q.typed.AgentsFilesList(ctx, generated.AgentsFilesListParams{AgentId: agentID})
}

func (q *GatewayQueries) AgentFilesSet(ctx context.Context, agentID string, name string, content string) (generated.AgentsFilesSetResult, error) {
	return q.typed.AgentsFilesSet(ctx, generated.AgentsFilesSetParams{
		AgentId: agentID,
		Name:    name,
		Content: content,
	})
}

func (q *GatewayQueries) AgentFilesGet(ctx context.Context, agentID string, name string) (generated.AgentsFilesGetResult, error) {
	return q.typed.AgentsFilesGet(ctx, generated.AgentsFilesGetParams{AgentId: agentID, Name: name})
}

func (q *GatewayQueries) ToolsCatalog(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "tools.catalog", body) // gateway:allow-untyped reason: upstream missing schema for tools.catalog, tracked in openspec D12
}

func (q *GatewayQueries) SkillsStatus(ctx context.Context, params map[string]any) (generated.SkillsStatusResult, error) {
	typedParams, err := typedParamsFromMap[generated.SkillsStatusParams](params)
	if err != nil {
		return generated.SkillsStatusResult{}, err
	}
	return q.typed.SkillsStatus(ctx, typedParams)
}

func (q *GatewayQueries) SkillsUpdate(ctx context.Context, body map[string]any) (generated.SkillsUpdateResult, error) {
	return q.typed.SkillsUpdate(ctx, body)
}

func (q *GatewayQueries) SkillsInstall(ctx context.Context, body map[string]any) (generated.SkillsInstallResult, error) {
	return q.typed.SkillsInstall(ctx, body)
}

func (q *GatewayQueries) SkillsSearch(ctx context.Context, body map[string]any) (generated.SkillsSearchResult, error) {
	params, err := typedParamsFromMap[generated.SkillsSearchParams](body)
	if err != nil {
		return generated.SkillsSearchResult{}, err
	}
	return q.typed.SkillsSearch(ctx, params)
}

func (q *GatewayQueries) SkillsDetail(ctx context.Context, body map[string]any) (generated.SkillsDetailResult, error) {
	params, err := typedParamsFromMap[generated.SkillsDetailParams](body)
	if err != nil {
		return generated.SkillsDetailResult{}, err
	}
	return q.typed.SkillsDetail(ctx, params)
}

func (q *GatewayQueries) SkillsBins(ctx context.Context) (generated.SkillsBinsResult, error) {
	return q.typed.SkillsBins(ctx, generated.SkillsBinsParams{})
}

func (q *GatewayQueries) DevicePairList(ctx context.Context) (generated.DevicePairListResult, error) {
	return q.typed.DevicePairList(ctx, generated.DevicePairListParams{})
}

func (q *GatewayQueries) DevicePairApprove(ctx context.Context, body map[string]any) (generated.DevicePairApproveResult, error) {
	params, err := typedParamsFromMap[generated.DevicePairApproveParams](body)
	if err != nil {
		return generated.DevicePairApproveResult{}, err
	}
	return q.typed.DevicePairApprove(ctx, params)
}

func (q *GatewayQueries) DevicePairReject(ctx context.Context, body map[string]any) (generated.DevicePairRejectResult, error) {
	params, err := typedParamsFromMap[generated.DevicePairRejectParams](body)
	if err != nil {
		return generated.DevicePairRejectResult{}, err
	}
	return q.typed.DevicePairReject(ctx, params)
}

func (q *GatewayQueries) DevicePairRemove(ctx context.Context, body map[string]any) (generated.DevicePairRemoveResult, error) {
	params, err := typedParamsFromMap[generated.DevicePairRemoveParams](body)
	if err != nil {
		return generated.DevicePairRemoveResult{}, err
	}
	return q.typed.DevicePairRemove(ctx, params)
}

func (q *GatewayQueries) DeviceTokenRotate(ctx context.Context, body map[string]any) (generated.DeviceTokenRotateResult, error) {
	params, err := typedParamsFromMap[generated.DeviceTokenRotateParams](body)
	if err != nil {
		return generated.DeviceTokenRotateResult{}, err
	}
	return q.typed.DeviceTokenRotate(ctx, params)
}

func (q *GatewayQueries) DeviceTokenRevoke(ctx context.Context, body map[string]any) (generated.DeviceTokenRevokeResult, error) {
	params, err := typedParamsFromMap[generated.DeviceTokenRevokeParams](body)
	if err != nil {
		return generated.DeviceTokenRevokeResult{}, err
	}
	return q.typed.DeviceTokenRevoke(ctx, params)
}

func (q *GatewayQueries) CronList(ctx context.Context, params map[string]any) (generated.CronListResult, error) {
	typedParams, err := typedParamsFromMap[generated.CronListParams](params)
	if err != nil {
		return generated.CronListResult{}, err
	}
	return q.typed.CronList(ctx, typedParams)
}

func (q *GatewayQueries) CronAdd(ctx context.Context, body map[string]any) (generated.CronAddResult, error) {
	params, err := typedParamsFromMap[generated.CronAddParams](body)
	if err != nil {
		return generated.CronAddResult{}, err
	}
	return q.typed.CronAdd(ctx, params)
}

func (q *GatewayQueries) CronUpdate(ctx context.Context, jobID string, patch map[string]any) (generated.CronUpdateResult, error) {
	return q.typed.CronUpdate(ctx, map[string]any{
		"id":    jobID,
		"patch": patch,
	})
}

func (q *GatewayQueries) CronRemove(ctx context.Context, jobID string) (generated.CronRemoveResult, error) {
	return q.typed.CronRemove(ctx, map[string]any{"id": jobID})
}

func (q *GatewayQueries) CronRun(ctx context.Context, params map[string]any) (generated.CronRunResult, error) {
	return q.typed.CronRun(ctx, params)
}

func (q *GatewayQueries) CronRuns(ctx context.Context, params map[string]any) (generated.CronRunsResult, error) {
	typedParams, err := typedParamsFromMap[generated.CronRunsParams](params)
	if err != nil {
		return generated.CronRunsResult{}, err
	}
	return q.typed.CronRuns(ctx, typedParams)
}

func (q *GatewayQueries) CronStatus(ctx context.Context) (generated.CronStatusResult, error) {
	return q.typed.CronStatus(ctx, generated.CronStatusParams{})
}

func (q *GatewayQueries) UsageCost(ctx context.Context, params map[string]any) (generated.UsageCostResult, error) {
	return q.typed.UsageCost(ctx, params)
}

func (q *GatewayQueries) UsageStatus(ctx context.Context) (generated.UsageStatusResult, error) {
	return q.typed.UsageStatus(ctx, map[string]any{})
}

func (q *GatewayQueries) SessionsUsage(ctx context.Context, params map[string]any) (generated.SessionsUsageResult, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsUsageParams](params)
	if err != nil {
		return generated.SessionsUsageResult{}, err
	}
	return q.typed.SessionsUsage(ctx, typedParams)
}

func (q *GatewayQueries) SessionsUsageLogs(ctx context.Context, params map[string]any) (generated.SessionsUsageLogsResult, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsUsageLogsParams](params)
	if err != nil {
		return generated.SessionsUsageLogsResult{}, err
	}
	return q.typed.SessionsUsageLogs(ctx, typedParams)
}

func (q *GatewayQueries) SessionsUsageTimeseries(ctx context.Context, params map[string]any) (generated.SessionsUsageTimeseriesResult, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsUsageTimeseriesParams](params)
	if err != nil {
		var zero generated.SessionsUsageTimeseriesResult
		return zero, err
	}
	return q.typed.SessionsUsageTimeseries(ctx, typedParams)
}

func typedParamsFromMap[T any](params map[string]any) (T, error) {
	var result T
	if params == nil {
		return result, nil
	}
	raw, err := json.Marshal(params)
	if err != nil {
		return result, err
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return result, err
	}
	return result, nil
}

func typedParamsToMap(params any) (map[string]any, error) {
	if params == nil {
		return map[string]any{}, nil
	}
	if paramsMap, ok := params.(map[string]any); ok {
		return paramsMap, nil
	}
	raw, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	result := map[string]any{}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (q *GatewayQueries) ChannelsStatus(ctx context.Context, params map[string]any) (generated.ChannelsStatusResult, error) {
	typedParams, err := typedParamsFromMap[generated.ChannelsStatusParams](params)
	if err != nil {
		return generated.ChannelsStatusResult{}, err
	}
	return q.typed.ChannelsStatus(ctx, typedParams)
}

func (q *GatewayQueries) ChannelsLogout(ctx context.Context, channelID string) (generated.ChannelsLogoutResult, error) {
	return q.typed.ChannelsLogout(ctx, generated.ChannelsLogoutParams{Channel: channelID})
}

func (q *GatewayQueries) DeckPluginsList(ctx context.Context, params map[string]any) (generated.DeckPluginsListResult, error) {
	typedParams, err := typedParamsFromMap[generated.DeckPluginsListParams](params)
	if err != nil {
		return generated.DeckPluginsListResult{}, err
	}
	return q.typed.DeckPluginsList(ctx, typedParams)
}

func (q *GatewayQueries) DeckAgentsDetail(ctx context.Context, agentID string) (generated.DeckAgentsDetailResult, error) {
	return q.typed.DeckAgentsDetail(ctx, generated.DeckAgentsDetailParams{AgentId: agentID})
}

func (q *GatewayQueries) DeckAgentsSkillsGet(ctx context.Context, body map[string]any) (generated.DeckAgentsSkillsGetResult, error) {
	params, err := typedParamsFromMap[generated.DeckAgentsSkillsGetParams](body)
	if err != nil {
		return generated.DeckAgentsSkillsGetResult{}, err
	}
	return q.typed.DeckAgentsSkillsGet(ctx, params)
}

func (q *GatewayQueries) DeckAgentsSkillsSet(ctx context.Context, body map[string]any) (generated.DeckAgentsSkillsSetResult, error) {
	params, err := typedParamsFromMap[generated.DeckAgentsSkillsSetParams](body)
	if err != nil {
		return generated.DeckAgentsSkillsSetResult{}, err
	}
	return q.typed.DeckAgentsSkillsSet(ctx, params)
}

func (q *GatewayQueries) DeckAgentsSubagentsGet(ctx context.Context, body map[string]any) (generated.DeckAgentsSubagentsGetResult, error) {
	params, err := typedParamsFromMap[generated.DeckAgentsSubagentsGetParams](body)
	if err != nil {
		return generated.DeckAgentsSubagentsGetResult{}, err
	}
	return q.typed.DeckAgentsSubagentsGet(ctx, params)
}

func (q *GatewayQueries) DeckAgentsSubagentsSet(ctx context.Context, body map[string]any) (generated.DeckAgentsSubagentsSetResult, error) {
	params, err := typedParamsFromMap[generated.DeckAgentsSubagentsSetParams](body)
	if err != nil {
		return generated.DeckAgentsSubagentsSetResult{}, err
	}
	return q.typed.DeckAgentsSubagentsSet(ctx, params)
}

func (q *GatewayQueries) DeckAgentsToolPolicyPreview(ctx context.Context, body map[string]any) (generated.DeckAgentsToolPolicyPreviewResult, error) {
	params, err := typedParamsFromMap[generated.DeckAgentsToolPolicyPreviewParams](body)
	if err != nil {
		return generated.DeckAgentsToolPolicyPreviewResult{}, err
	}
	return q.typed.DeckAgentsToolPolicyPreview(ctx, params)
}

func (q *GatewayQueries) DeckAgentsSystemPromptPreview(ctx context.Context, body map[string]any) (generated.DeckAgentsSystemPromptPreviewResult, error) {
	params, err := typedParamsFromMap[generated.DeckAgentsSystemPromptPreviewParams](body)
	if err != nil {
		return generated.DeckAgentsSystemPromptPreviewResult{}, err
	}
	return q.typed.DeckAgentsSystemPromptPreview(ctx, params)
}

func (q *GatewayQueries) DeckAgentsEventStreamsGet(ctx context.Context, body map[string]any) (generated.DeckAgentsEventStreamsGetResult, error) {
	params, err := typedParamsFromMap[generated.DeckAgentsEventStreamsGetParams](body)
	if err != nil {
		return generated.DeckAgentsEventStreamsGetResult{}, err
	}
	return q.typed.DeckAgentsEventStreamsGet(ctx, params)
}

func (q *GatewayQueries) DeckAgentsEventStreamsSet(ctx context.Context, body map[string]any) (generated.DeckAgentsEventStreamsSetResult, error) {
	params, err := typedParamsFromMap[generated.DeckAgentsEventStreamsSetParams](body)
	if err != nil {
		return generated.DeckAgentsEventStreamsSetResult{}, err
	}
	return q.typed.DeckAgentsEventStreamsSet(ctx, params)
}

func (q *GatewayQueries) DeckCommandsDiscover(ctx context.Context, body map[string]any) (generated.DeckCommandsDiscoverResult, error) {
	params, err := typedParamsFromMap[generated.DeckCommandsDiscoverParams](body)
	if err != nil {
		return generated.DeckCommandsDiscoverResult{}, err
	}
	return q.typed.DeckCommandsDiscover(ctx, params)
}

func (q *GatewayQueries) ToolsEffective(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "tools.effective", body) // gateway:allow-untyped reason: upstream missing schema for tools.effective, tracked in openspec D12
}

func (q *GatewayQueries) ExecApprovalList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "exec.approval.list", map[string]any{}) // gateway:allow-untyped reason: upstream missing schema for exec.approval.list, tracked in openspec D12
}

func (q *GatewayQueries) ExecApprovalsGet(ctx context.Context) (generated.ExecApprovalsGetResult, error) {
	return q.typed.ExecApprovalsGet(ctx, generated.ExecApprovalsGetParams{})
}

func (q *GatewayQueries) ExecApprovalResolve(ctx context.Context, body map[string]any) (generated.ExecApprovalResolveResult, error) {
	params, err := typedParamsFromMap[generated.ExecApprovalResolveParams](body)
	if err != nil {
		return generated.ExecApprovalResolveResult{}, err
	}
	return q.typed.ExecApprovalResolve(ctx, params)
}

func (q *GatewayQueries) ExecApprovalsSet(ctx context.Context, body map[string]any) (generated.ExecApprovalsSetResult, error) {
	params, err := typedParamsFromMap[generated.ExecApprovalsSetParams](body)
	if err != nil {
		return generated.ExecApprovalsSetResult{}, err
	}
	return q.typed.ExecApprovalsSet(ctx, params)
}

func (q *GatewayQueries) PluginApprovalList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "plugin.approval.list", map[string]any{}) // gateway:allow-untyped reason: upstream missing schema for plugin.approval.list, tracked in openspec D12
}

func (q *GatewayQueries) PluginApprovalResolve(ctx context.Context, body map[string]any) (any, error) {
	params, err := typedParamsFromMap[generated.PluginApprovalResolveParams](body)
	if err != nil {
		return nil, err
	}
	return q.typed.PluginApprovalResolve(ctx, params)
}

func (q *GatewayQueries) DeckIdentityList(ctx context.Context) (generated.DeckIdentityListResult, error) {
	return q.typed.DeckIdentityList(ctx, generated.DeckIdentityListParams{})
}

func (q *GatewayQueries) DeckIdentityLink(ctx context.Context, body map[string]any) (generated.DeckIdentityLinkResult, error) {
	params, err := typedParamsFromMap[generated.DeckIdentityLinkParams](body)
	if err != nil {
		return generated.DeckIdentityLinkResult{}, err
	}
	return q.typed.DeckIdentityLink(ctx, params)
}

func (q *GatewayQueries) DeckIdentityUnlink(ctx context.Context, body map[string]any) (generated.DeckIdentityUnlinkResult, error) {
	params, err := typedParamsFromMap[generated.DeckIdentityUnlinkParams](body)
	if err != nil {
		return generated.DeckIdentityUnlinkResult{}, err
	}
	return q.typed.DeckIdentityUnlink(ctx, params)
}

func (q *GatewayQueries) DeckRoutingList(ctx context.Context, params map[string]any) (generated.DeckRoutingListResult, error) {
	typedParams, err := typedParamsFromMap[generated.DeckRoutingListParams](params)
	if err != nil {
		return generated.DeckRoutingListResult{}, err
	}
	return q.typed.DeckRoutingList(ctx, typedParams)
}

func (q *GatewayQueries) DeckRoutingAdd(ctx context.Context, body map[string]any) (generated.DeckRoutingAddResult, error) {
	params, err := typedParamsFromMap[generated.DeckRoutingAddParams](body)
	if err != nil {
		return generated.DeckRoutingAddResult{}, err
	}
	return q.typed.DeckRoutingAdd(ctx, params)
}

func (q *GatewayQueries) DeckRoutingRemove(ctx context.Context, body map[string]any) (generated.DeckRoutingRemoveResult, error) {
	params, err := typedParamsFromMap[generated.DeckRoutingRemoveParams](body)
	if err != nil {
		return generated.DeckRoutingRemoveResult{}, err
	}
	return q.typed.DeckRoutingRemove(ctx, params)
}

func (q *GatewayQueries) DeckRoutingValidate(ctx context.Context, body map[string]any) (generated.DeckRoutingValidateResult, error) {
	params, err := typedParamsFromMap[generated.DeckRoutingValidateParams](body)
	if err != nil {
		return generated.DeckRoutingValidateResult{}, err
	}
	return q.typed.DeckRoutingValidate(ctx, params)
}

func (q *GatewayQueries) DeckRoutingSimulate(ctx context.Context, body map[string]any) (generated.DeckRoutingSimulateResult, error) {
	params, err := typedParamsFromMap[generated.DeckRoutingSimulateParams](body)
	if err != nil {
		return generated.DeckRoutingSimulateResult{}, err
	}
	return q.typed.DeckRoutingSimulate(ctx, params)
}

func (q *GatewayQueries) DeckSubagentsList(ctx context.Context, params map[string]any) (generated.DeckSubagentsListResult, error) {
	typedParams, err := typedParamsFromMap[generated.DeckSubagentsListParams](params)
	if err != nil {
		return generated.DeckSubagentsListResult{}, err
	}
	return q.typed.DeckSubagentsList(ctx, typedParams)
}

func (q *GatewayQueries) DeckSubagentsKill(ctx context.Context, body map[string]any) (generated.DeckSubagentsKillResult, error) {
	params, err := typedParamsFromMap[generated.DeckSubagentsKillParams](body)
	if err != nil {
		return generated.DeckSubagentsKillResult{}, err
	}
	return q.typed.DeckSubagentsKill(ctx, params)
}

func (q *GatewayQueries) DeckSubagentsLineage(ctx context.Context, body map[string]any) (generated.DeckSubagentsLineageResult, error) {
	params, err := typedParamsFromMap[generated.DeckSubagentsLineageParams](body)
	if err != nil {
		return generated.DeckSubagentsLineageResult{}, err
	}
	return q.typed.DeckSubagentsLineage(ctx, params)
}

func (q *GatewayQueries) DeckSubagentsSteer(ctx context.Context, body map[string]any) (generated.DeckSubagentsSteerResult, error) {
	params, err := typedParamsFromMap[generated.DeckSubagentsSteerParams](body)
	if err != nil {
		return generated.DeckSubagentsSteerResult{}, err
	}
	return q.typed.DeckSubagentsSteer(ctx, params)
}

func (q *GatewayQueries) DeckThreadsList(ctx context.Context, params map[string]any) (generated.DeckThreadsListResult, error) {
	typedParams, err := typedParamsFromMap[generated.DeckThreadsListParams](params)
	if err != nil {
		return generated.DeckThreadsListResult{}, err
	}
	return q.typed.DeckThreadsList(ctx, typedParams)
}

func (q *GatewayQueries) LogsTail(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "logs.tail", params) // gateway:allow-untyped reason: upstream missing schema for logs.tail, tracked in openspec D12
}

func (q *GatewayQueries) SessionsDelete(ctx context.Context, sessionKey string) (generated.SessionsDeleteResult, error) {
	return q.typed.SessionsDelete(ctx, generated.SessionsDeleteParams{Key: sessionKey})
}

func (q *GatewayQueries) SessionsGet(ctx context.Context, params map[string]any) (generated.SessionsGetResult, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsGetParams](params)
	if err != nil {
		return generated.SessionsGetResult{}, err
	}
	return q.typed.SessionsGet(ctx, typedParams)
}

func (q *GatewayQueries) SessionsListRaw(ctx context.Context, params map[string]any) (generated.SessionsListResult, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsListParams](params)
	if err != nil {
		return generated.SessionsListResult{}, err
	}
	return q.typed.SessionsList(ctx, typedParams)
}

func (q *GatewayQueries) ChatHistory(ctx context.Context, params map[string]any) (generated.ChatHistoryResult, error) {
	typedParams, err := typedParamsFromMap[generated.ChatHistoryParams](params)
	if err != nil {
		return generated.ChatHistoryResult{}, err
	}
	return q.typed.ChatHistory(ctx, typedParams)
}

func (q *GatewayQueries) DoctorMemoryStatus(ctx context.Context) (generated.DoctorMemoryStatusResult, error) {
	return q.typed.DoctorMemoryStatus(ctx, map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryDreamDiary(ctx context.Context) (generated.DoctorMemoryDreamDiaryResult, error) {
	return q.typed.DoctorMemoryDreamDiary(ctx, map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryBackfillDreamDiary(ctx context.Context) (generated.DoctorMemoryBackfillDreamDiaryResult, error) {
	return q.typed.DoctorMemoryBackfillDreamDiary(ctx, map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryResetDreamDiary(ctx context.Context) (generated.DoctorMemoryResetDreamDiaryResult, error) {
	return q.typed.DoctorMemoryResetDreamDiary(ctx, map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryResetGroundedShortTerm(ctx context.Context) (generated.DoctorMemoryResetGroundedShortTermResult, error) {
	return q.typed.DoctorMemoryResetGroundedShortTerm(ctx, map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryRepairDreamingArtifacts(ctx context.Context) (generated.DoctorMemoryRepairDreamingArtifactsResult, error) {
	return q.typed.DoctorMemoryRepairDreamingArtifacts(ctx, map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryDedupeDreamDiary(ctx context.Context) (generated.DoctorMemoryDedupeDreamDiaryResult, error) {
	return q.typed.DoctorMemoryDedupeDreamDiary(ctx, map[string]any{})
}

func (q *GatewayQueries) SessionsPreview(ctx context.Context, keys []string) (generated.SessionsPreviewResult, error) {
	return q.typed.SessionsPreview(ctx, generated.SessionsPreviewParams{Keys: keys})
}

func (q *GatewayQueries) SessionsReset(ctx context.Context, sessionKey string, reason string) (generated.SessionsResetResult, error) {
	return q.typed.SessionsReset(ctx, generated.SessionsResetParams{Key: sessionKey, Reason: reason})
}

func (q *GatewayQueries) SessionsClear(ctx context.Context, sessionKey string) (generated.SessionsClearResult, error) {
	return q.typed.SessionsClear(ctx, generated.SessionsClearParams{Key: sessionKey})
}

func (q *GatewayQueries) SessionsPatch(ctx context.Context, body map[string]any) (generated.SessionsPatchResult, error) {
	params, err := typedParamsFromMap[generated.SessionsPatchParams](body)
	if err != nil {
		return generated.SessionsPatchResult{}, err
	}
	return q.typed.SessionsPatch(ctx, params)
}

func (q *GatewayQueries) SessionsCreate(ctx context.Context, params map[string]any) (generated.SessionsCreateResult, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsCreateParams](params)
	if err != nil {
		return generated.SessionsCreateResult{}, err
	}
	return q.typed.SessionsCreate(ctx, typedParams)
}

func (q *GatewayQueries) SessionsSend(ctx context.Context, params map[string]any) (generated.SessionsSendResult, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsSendParams](params)
	if err != nil {
		return generated.SessionsSendResult{}, err
	}
	return q.typed.SessionsSend(ctx, typedParams)
}

func (q *GatewayQueries) SessionsAbort(ctx context.Context, params map[string]any) (generated.SessionsAbortResult, error) {
	typedParams, err := typedParamsFromMap[generated.SessionsAbortParams](params)
	if err != nil {
		return generated.SessionsAbortResult{}, err
	}
	return q.typed.SessionsAbort(ctx, typedParams)
}

func (q *GatewayQueries) SessionsCompact(ctx context.Context, sessionKey string) (generated.SessionsCompactResult, error) {
	return q.typed.SessionsCompact(ctx, generated.SessionsCompactParams{Key: sessionKey})
}

func (q *GatewayQueries) SessionsCompactionList(ctx context.Context, sessionKey string) (generated.SessionsCompactionListResult, error) {
	return q.typed.SessionsCompactionList(ctx, generated.SessionsCompactionListParams{Key: sessionKey})
}

func (q *GatewayQueries) SessionsCompactionBranch(ctx context.Context, sessionKey string, checkpointID string) (generated.SessionsCompactionBranchResult, error) {
	return q.typed.SessionsCompactionBranch(ctx, generated.SessionsCompactionBranchParams{
		Key:          sessionKey,
		CheckpointId: checkpointID,
	})
}

func (q *GatewayQueries) SessionsCompactionRestore(ctx context.Context, sessionKey string, checkpointID string) (generated.SessionsCompactionRestoreResult, error) {
	return q.typed.SessionsCompactionRestore(ctx, generated.SessionsCompactionRestoreParams{
		Key:          sessionKey,
		CheckpointId: checkpointID,
	})
}

func (q *GatewayQueries) SessionsSteer(ctx context.Context, sessionKey string, message string) (generated.SessionsSteerResult, error) {
	return q.typed.SessionsSteer(ctx, generated.SessionsSteerParams{
		Key:     sessionKey,
		Message: message,
	})
}

func (q *GatewayQueries) CommandsList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "commands.list", map[string]any{}) // gateway:allow-untyped reason: upstream missing schema for commands.list, tracked in openspec D12
}

func (q *GatewayQueries) NodeList(ctx context.Context) (generated.NodeListResult, error) {
	return q.typed.NodeList(ctx, generated.NodeListParams{})
}

func (q *GatewayQueries) NodeDescribe(ctx context.Context, body map[string]any) (generated.NodeDescribeResult, error) {
	params, err := typedParamsFromMap[generated.NodeDescribeParams](body)
	if err != nil {
		return generated.NodeDescribeResult{}, err
	}
	return q.typed.NodeDescribe(ctx, params)
}

func (q *GatewayQueries) NodeRename(ctx context.Context, body map[string]any) (generated.NodeRenameResult, error) {
	params, err := typedParamsFromMap[generated.NodeRenameParams](body)
	if err != nil {
		return generated.NodeRenameResult{}, err
	}
	return q.typed.NodeRename(ctx, params)
}

func (q *GatewayQueries) NodeInvoke(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.invoke", body) // gateway:allow-untyped reason: upstream missing schema for node.invoke, tracked in openspec D12
}

func (q *GatewayQueries) NodePendingEnqueue(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.pending.enqueue", body) // gateway:allow-untyped reason: upstream missing schema for node.pending.enqueue, tracked in openspec D12
}

func (q *GatewayQueries) NodePairList(ctx context.Context) (generated.NodePairListResult, error) {
	return q.typed.NodePairList(ctx, generated.NodePairListParams{})
}

func (q *GatewayQueries) NodePairRequest(ctx context.Context, body map[string]any) (generated.NodePairRequestResult, error) {
	params, err := typedParamsFromMap[generated.NodePairRequestParams](body)
	if err != nil {
		return generated.NodePairRequestResult{}, err
	}
	return q.typed.NodePairRequest(ctx, params)
}

func (q *GatewayQueries) NodePairApprove(ctx context.Context, body map[string]any) (generated.NodePairApproveResult, error) {
	params, err := typedParamsFromMap[generated.NodePairApproveParams](body)
	if err != nil {
		return generated.NodePairApproveResult{}, err
	}
	return q.typed.NodePairApprove(ctx, params)
}

func (q *GatewayQueries) NodePairReject(ctx context.Context, body map[string]any) (generated.NodePairRejectResult, error) {
	params, err := typedParamsFromMap[generated.NodePairRejectParams](body)
	if err != nil {
		return generated.NodePairRejectResult{}, err
	}
	return q.typed.NodePairReject(ctx, params)
}

func (q *GatewayQueries) NodePairVerify(ctx context.Context, body map[string]any) (generated.NodePairVerifyResult, error) {
	params, err := typedParamsFromMap[generated.NodePairVerifyParams](body)
	if err != nil {
		return generated.NodePairVerifyResult{}, err
	}
	return q.typed.NodePairVerify(ctx, params)
}

func (q *GatewayQueries) ModelsList(ctx context.Context) (generated.ModelsListResult, error) {
	return q.typed.ModelsList(ctx, generated.ModelsListParams{})
}

func (q *GatewayQueries) ModelsConfigured(ctx context.Context) (generated.ModelsConfiguredResult, error) {
	return q.typed.ModelsConfigured(ctx, generated.ModelsConfiguredParams{})
}

func (q *GatewayQueries) ModelsCatalogProviders(ctx context.Context) (generated.ModelsCatalogProvidersResult, error) {
	return q.typed.ModelsCatalogProviders(ctx, map[string]any{})
}

func (q *GatewayQueries) TalkConfig(ctx context.Context, includeSecrets bool) (generated.TalkConfigResult, error) {
	return q.typed.TalkConfig(ctx, generated.TalkConfigParams{IncludeSecrets: includeSecrets})
}

func (q *GatewayQueries) TalkMode(ctx context.Context, enabled bool, phase string) (generated.TalkModeResult, error) {
	return q.typed.TalkMode(ctx, generated.TalkModeParams{
		Enabled: enabled,
		Phase:   phase,
	})
}

func (q *GatewayQueries) TalkSpeak(ctx context.Context, params map[string]any) (generated.TalkSpeakResult, error) {
	typedParams, err := typedParamsFromMap[generated.TalkSpeakParams](params)
	if err != nil {
		return generated.TalkSpeakResult{}, err
	}
	return q.typed.TalkSpeak(ctx, typedParams)
}

func (q *GatewayQueries) WizardStart(ctx context.Context, params map[string]any) (generated.WizardStartResult, error) {
	typedParams, err := typedParamsFromMap[generated.WizardStartParams](params)
	if err != nil {
		return generated.WizardStartResult{}, err
	}
	return q.typed.WizardStart(ctx, typedParams)
}

func (q *GatewayQueries) WizardNext(ctx context.Context, params map[string]any) (generated.WizardNextResult, error) {
	typedParams, err := typedParamsFromMap[generated.WizardNextParams](params)
	if err != nil {
		return generated.WizardNextResult{}, err
	}
	return q.typed.WizardNext(ctx, typedParams)
}

func (q *GatewayQueries) WizardCancel(ctx context.Context, sessionID string) (generated.WizardCancelResult, error) {
	return q.typed.WizardCancel(ctx, generated.WizardCancelParams{SessionId: sessionID})
}

func (q *GatewayQueries) WizardStatus(ctx context.Context, sessionID string) (generated.WizardStatusResult, error) {
	return q.typed.WizardStatus(ctx, generated.WizardStatusParams{SessionId: sessionID})
}

func (q *GatewayQueries) DeckAuthOverview(ctx context.Context) (generated.DeckAuthOverviewResult, error) {
	return q.typed.DeckAuthOverview(ctx, map[string]any{})
}

func (q *GatewayQueries) DeckAuthProbe(ctx context.Context, body map[string]any) (generated.DeckAuthProbeResult, error) {
	return q.typed.DeckAuthProbe(ctx, body)
}
