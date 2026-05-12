package openclaw

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
)

type LegacyInventorySurface struct {
	managed ManagedRuntimeSurface
}

func NewLegacyInventorySurface(managed ManagedRuntimeSurface) *LegacyInventorySurface {
	return &LegacyInventorySurface{managed: managed}
}

func (s *LegacyInventorySurface) CurrentDeviceID() (string, error) {
	return s.managed.CurrentDeviceID()
}

func (s *LegacyInventorySurface) AgentsList(ctx context.Context) (deckapi.DeckGoAgentsListResponse, error) {
	payload, err := s.managed.GatewayQueries().AgentsList(ctx)
	if err != nil {
		return deckapi.DeckGoAgentsListResponse{}, err
	}
	return normalizeAgentsList(payload), nil
}

func (s *LegacyInventorySurface) AgentsCreate(ctx context.Context, params map[string]any) (deckapi.DeckGoAgentMutationResponse, error) {
	payload, err := s.managed.GatewayQueries().AgentsCreate(ctx, params)
	if err != nil {
		return deckapi.DeckGoAgentMutationResponse{}, err
	}
	return normalizeAgentCreate(payload), nil
}

func (s *LegacyInventorySurface) AgentsDelete(ctx context.Context, agentID string) (deckapi.DeckGoAgentMutationResponse, error) {
	payload, err := s.managed.GatewayQueries().AgentsDelete(ctx, agentID, false)
	if err != nil {
		return deckapi.DeckGoAgentMutationResponse{}, err
	}
	return normalizeAgentDelete(payload), nil
}

func (s *LegacyInventorySurface) AgentsUpdate(ctx context.Context, body map[string]any) (deckapi.DeckGoAgentMutationResponse, error) {
	payload, err := s.managed.GatewayQueries().AgentsUpdate(ctx, body)
	if err != nil {
		return deckapi.DeckGoAgentMutationResponse{}, err
	}
	return normalizeAgentUpdate(payload), nil
}

func (s *LegacyInventorySurface) AgentFilesList(ctx context.Context, agentID string) (any, error) {
	return s.managed.GatewayQueries().AgentFilesList(ctx, agentID)
}

func (s *LegacyInventorySurface) AgentFilesSet(ctx context.Context, agentID string, name string, content string) (any, error) {
	return s.managed.GatewayQueries().AgentFilesSet(ctx, agentID, name, content)
}

func (s *LegacyInventorySurface) AgentFilesGet(ctx context.Context, agentID string, name string) (any, error) {
	return s.managed.GatewayQueries().AgentFilesGet(ctx, agentID, name)
}

func (s *LegacyInventorySurface) AgentIdentityGet(ctx context.Context, agentID string) (any, error) {
	return s.managed.GatewayQueries().AgentIdentityGet(ctx, agentID)
}

func (s *LegacyInventorySurface) ToolsCatalog(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().ToolsCatalog(ctx, body)
}

func (s *LegacyInventorySurface) SkillsStatus(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().SkillsStatus(ctx, params)
}

func (s *LegacyInventorySurface) SkillsUpdate(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().SkillsUpdate(ctx, body)
}

func (s *LegacyInventorySurface) SkillsInstall(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().SkillsInstall(ctx, body)
}

func (s *LegacyInventorySurface) SkillsSearch(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().SkillsSearch(ctx, body)
}

func (s *LegacyInventorySurface) SkillsDetail(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().SkillsDetail(ctx, body)
}

func (s *LegacyInventorySurface) SkillsBins(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().SkillsBins(ctx)
}

func (s *LegacyInventorySurface) DevicePairList(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().DevicePairList(ctx)
}

func (s *LegacyInventorySurface) DevicePairApprove(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DevicePairApprove(ctx, body)
}

func (s *LegacyInventorySurface) DevicePairReject(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DevicePairReject(ctx, body)
}

func (s *LegacyInventorySurface) DevicePairRemove(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DevicePairRemove(ctx, body)
}

func (s *LegacyInventorySurface) DeviceTokenRotate(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeviceTokenRotate(ctx, body)
}

func (s *LegacyInventorySurface) DeviceTokenRevoke(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeviceTokenRevoke(ctx, body)
}

func (s *LegacyInventorySurface) CommandsList(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().CommandsList(ctx)
}

func (s *LegacyInventorySurface) NodeList(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().NodeList(ctx)
}

func (s *LegacyInventorySurface) NodeDescribe(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().NodeDescribe(ctx, body)
}

func (s *LegacyInventorySurface) NodeRename(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().NodeRename(ctx, body)
}

func (s *LegacyInventorySurface) NodeInvoke(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().NodeInvoke(ctx, body)
}

func (s *LegacyInventorySurface) NodePendingEnqueue(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().NodePendingEnqueue(ctx, body)
}

func (s *LegacyInventorySurface) NodePairList(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().NodePairList(ctx)
}

func (s *LegacyInventorySurface) NodePairRequest(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().NodePairRequest(ctx, body)
}

func (s *LegacyInventorySurface) NodePairApprove(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().NodePairApprove(ctx, body)
}

func (s *LegacyInventorySurface) NodePairReject(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().NodePairReject(ctx, body)
}

func (s *LegacyInventorySurface) NodePairVerify(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().NodePairVerify(ctx, body)
}

func (s *LegacyInventorySurface) CronList(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().CronList(ctx, params)
}

func (s *LegacyInventorySurface) CronAdd(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().CronAdd(ctx, body)
}

func (s *LegacyInventorySurface) CronUpdate(ctx context.Context, jobID string, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().CronUpdate(ctx, jobID, body)
}

func (s *LegacyInventorySurface) CronRemove(ctx context.Context, jobID string) (any, error) {
	return s.managed.GatewayQueries().CronRemove(ctx, jobID)
}

func (s *LegacyInventorySurface) CronRun(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().CronRun(ctx, body)
}

func (s *LegacyInventorySurface) CronRuns(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().CronRuns(ctx, params)
}

func (s *LegacyInventorySurface) CronStatus(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().CronStatus(ctx)
}

func (s *LegacyInventorySurface) UsageCost(ctx context.Context, params map[string]any) (deckapi.DeckGoUsageCostResponse, error) {
	payload, err := s.managed.GatewayQueries().UsageCost(ctx, params)
	if err != nil {
		return deckapi.DeckGoUsageCostResponse{}, err
	}
	return normalizeUsageCost(payload), nil
}

func (s *LegacyInventorySurface) UsageStatus(ctx context.Context) (deckapi.DeckGoUsageProvidersResponse, error) {
	payload, err := s.managed.GatewayQueries().UsageStatus(ctx)
	if err != nil {
		return deckapi.DeckGoUsageProvidersResponse{}, err
	}
	return normalizeUsageProviders(payload), nil
}

func (s *LegacyInventorySurface) SessionsUsage(ctx context.Context, params map[string]any) (deckapi.DeckGoUsageSessionsResponse, error) {
	payload, err := s.managed.GatewayQueries().SessionsUsage(ctx, params)
	if err != nil {
		return deckapi.DeckGoUsageSessionsResponse{}, err
	}
	return normalizeUsageSessions(payload), nil
}

func (s *LegacyInventorySurface) SessionsUsageLogs(ctx context.Context, params map[string]any) (deckapi.DeckGoUsageSessionLogsResponse, error) {
	payload, err := s.managed.GatewayQueries().SessionsUsageLogs(ctx, params)
	if err != nil {
		return deckapi.DeckGoUsageSessionLogsResponse{}, err
	}
	return normalizeUsageSessionLogs(payload), nil
}

func (s *LegacyInventorySurface) SessionsUsageTimeseries(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().SessionsUsageTimeseries(ctx, params)
}

func (s *LegacyInventorySurface) ConfigGet(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().ConfigGet(ctx)
}

func (s *LegacyInventorySurface) ConfigGetWithParams(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().ConfigGetWithParams(ctx, params)
}

func (s *LegacyInventorySurface) ConfigPatch(ctx context.Context, raw string, baseHash string, note string) (any, error) {
	return s.managed.GatewayQueries().ConfigPatch(ctx, raw, baseHash, note)
}

func (s *LegacyInventorySurface) ConfigApply(ctx context.Context, raw string, baseHash string) (any, error) {
	return s.managed.GatewayQueries().ConfigApply(ctx, raw, baseHash)
}

func (s *LegacyInventorySurface) ChannelsStatus(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().ChannelsStatus(ctx, params)
}

func (s *LegacyInventorySurface) ChannelsLogout(ctx context.Context, channelID string) (any, error) {
	return s.managed.GatewayQueries().ChannelsLogout(ctx, channelID)
}

func (s *LegacyInventorySurface) ListSessionsWithParams(ctx context.Context, params map[string]any, agentID string) ([]deckapi.DeckGoSessionMeta, error) {
	return s.managed.SessionQueries().ListSessionsWithParams(ctx, params, agentID)
}

func (s *LegacyInventorySurface) GetTimelineWithParams(ctx context.Context, sessionKey string, agentID string, limit int) (deckapi.DeckGoSessionDetailResponse, error) {
	return s.managed.SessionQueries().GetTimelineWithParams(ctx, sessionKey, agentID, limit)
}

func (s *LegacyInventorySurface) LogsTail(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().LogsTail(ctx, params)
}

func (s *LegacyInventorySurface) DeckPluginsList(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckPluginsList(ctx, params)
}

func (s *LegacyInventorySurface) DeckAgentsDetail(ctx context.Context, agentID string) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsDetail(ctx, agentID)
}

func (s *LegacyInventorySurface) HealthWithParams(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().HealthWithParams(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsSkillsGet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsSkillsGet(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsSkillsSet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsSkillsSet(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsSubagentsGet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsSubagentsGet(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsSubagentsSet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsSubagentsSet(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsModelPolicyGet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsModelPolicyGet(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsModelPolicySet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsModelPolicySet(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsToolPolicyPreview(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsToolPolicyPreview(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsSystemPromptPreview(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsSystemPromptPreview(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsEventStreamsGet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsEventStreamsGet(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsEventStreamsSet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsEventStreamsSet(ctx, body)
}

func (s *LegacyInventorySurface) DeckAgentsImpactPreviewGet(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckAgentsImpactPreviewGet(ctx, body)
}

func (s *LegacyInventorySurface) DeckCommandsDiscover(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckCommandsDiscover(ctx, body)
}

func (s *LegacyInventorySurface) ToolsEffective(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().ToolsEffective(ctx, body)
}

func (s *LegacyInventorySurface) ExecApprovalsGet(ctx context.Context) (deckapi.DeckGoApprovalPolicyResponse, error) {
	payload, err := s.managed.GatewayQueries().ExecApprovalsGet(ctx)
	if err != nil {
		return deckapi.DeckGoApprovalPolicyResponse{}, err
	}
	return normalizeApprovalPolicyFromGet(payload), nil
}

func (s *LegacyInventorySurface) ExecApprovalResolve(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().ExecApprovalResolve(ctx, body)
}

func (s *LegacyInventorySurface) ExecApprovalList(ctx context.Context) (deckapi.DeckGoPendingApprovalsResponse, error) {
	payload, err := s.managed.GatewayQueries().ExecApprovalList(ctx)
	if err != nil {
		return deckapi.DeckGoPendingApprovalsResponse{}, err
	}
	return normalizePendingApprovals(payload), nil
}

func (s *LegacyInventorySurface) ExecApprovalsSet(ctx context.Context, body map[string]any) (deckapi.DeckGoApprovalPolicyResponse, error) {
	payload, err := s.managed.GatewayQueries().ExecApprovalsSet(ctx, body)
	if err != nil {
		return deckapi.DeckGoApprovalPolicyResponse{}, err
	}
	return normalizeApprovalPolicyFromSet(payload), nil
}

func (s *LegacyInventorySurface) PluginApprovalList(ctx context.Context) (any, error) {
	payload, err := s.managed.GatewayQueries().PluginApprovalList(ctx)
	if err != nil {
		return nil, err
	}
	return normalizePluginApprovals(payload), nil
}

func (s *LegacyInventorySurface) PluginApprovalResolve(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().PluginApprovalResolve(ctx, body)
}

func (s *LegacyInventorySurface) DeckIdentityList(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().DeckIdentityList(ctx)
}

func (s *LegacyInventorySurface) DeckIdentityLink(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckIdentityLink(ctx, body)
}

func (s *LegacyInventorySurface) DeckIdentityUnlink(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckIdentityUnlink(ctx, body)
}

func (s *LegacyInventorySurface) DeckRoutingList(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckRoutingList(ctx, params)
}

func (s *LegacyInventorySurface) DeckRoutingAdd(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckRoutingAdd(ctx, body)
}

func (s *LegacyInventorySurface) DeckRoutingRemove(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckRoutingRemove(ctx, body)
}

func (s *LegacyInventorySurface) DeckRoutingValidate(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckRoutingValidate(ctx, body)
}

func (s *LegacyInventorySurface) DeckRoutingSimulate(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckRoutingSimulate(ctx, body)
}

func (s *LegacyInventorySurface) DeckSubagentsList(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckSubagentsList(ctx, params)
}

func (s *LegacyInventorySurface) DeckSubagentsKill(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckSubagentsKill(ctx, body)
}

func (s *LegacyInventorySurface) DeckSubagentsLineage(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckSubagentsLineage(ctx, body)
}

func (s *LegacyInventorySurface) DeckSubagentsSteer(ctx context.Context, body map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckSubagentsSteer(ctx, body)
}

func (s *LegacyInventorySurface) DeckThreadsList(ctx context.Context, params map[string]any) (any, error) {
	return s.managed.GatewayQueries().DeckThreadsList(ctx, params)
}

func (s *LegacyInventorySurface) DefaultAgentWorkspace(ctx context.Context, name string) string {
	if strings.TrimSpace(name) == "" {
		return ""
	}
	if payload, err := s.managed.GatewayQueries().ConfigGetWithParams(ctx, map[string]any{"path": "agents.defaults.workspace"}); err == nil {
		if strings.TrimSpace(payload.Raw) != "" {
			return payload.Raw
		}
	}
	stateDir := strings.TrimSpace(os.Getenv("OPENCLAW_STATE_DIR"))
	if stateDir == "" {
		homeDir, err := os.UserHomeDir()
		if err == nil && homeDir != "" {
			stateDir = filepath.Join(homeDir, ".openclaw")
		} else {
			stateDir = ".openclaw"
		}
	}
	agentID := strings.ToLower(strings.Join(strings.Fields(name), "-"))
	return filepath.Join(stateDir, "workspace-"+agentID)
}

func (s *LegacyInventorySurface) ModelsConfigured(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().ModelsConfigured(ctx)
}

func (s *LegacyInventorySurface) ModelsCatalogProviders(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().ModelsCatalogProviders(ctx)
}

func (s *LegacyInventorySurface) DeckAuthOverview(ctx context.Context) (any, error) {
	return s.managed.GatewayQueries().DeckAuthOverview(ctx)
}
