package openclaw

import "context"

type GatewayQueries struct {
	requester Requester
}

func NewGatewayQueries(requester Requester) *GatewayQueries {
	return &GatewayQueries{requester: requester}
}

func (q *GatewayQueries) Describe(ctx context.Context, includeSchemas bool) (any, error) {
	return q.requester.Request(ctx, "gateway.describe", map[string]any{
		"filter":         "all",
		"includeSchemas": includeSchemas,
	})
}

func (q *GatewayQueries) Health(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "health", map[string]any{})
}

func (q *GatewayQueries) HealthWithParams(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "health", params)
}

func (q *GatewayQueries) Status(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "status", map[string]any{})
}

func (q *GatewayQueries) ConfigSchemaLookup(ctx context.Context, path string) (any, error) {
	return q.requester.Request(ctx, "config.schema.lookup", map[string]any{"path": path})
}

func (q *GatewayQueries) ConfigSchema(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "config.schema", map[string]any{})
}

func (q *GatewayQueries) ConfigGet(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "config.get", map[string]any{})
}

func (q *GatewayQueries) ConfigGetWithParams(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "config.get", params)
}

func (q *GatewayQueries) ConfigPatch(ctx context.Context, raw string, baseHash string, note string) (any, error) {
	params := map[string]any{"raw": raw}
	if baseHash != "" {
		params["baseHash"] = baseHash
	}
	if note != "" {
		params["note"] = note
	}
	return q.requester.Request(ctx, "config.patch", params)
}

func (q *GatewayQueries) ConfigApply(ctx context.Context, raw string, baseHash string) (any, error) {
	params := map[string]any{"raw": raw}
	if baseHash != "" {
		params["baseHash"] = baseHash
	}
	return q.requester.Request(ctx, "config.apply", params)
}

func (q *GatewayQueries) AgentsList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "agents.list", map[string]any{})
}

func (q *GatewayQueries) AgentIdentityGet(ctx context.Context, agentID string) (any, error) {
	return q.requester.Request(ctx, "agent.identity.get", map[string]any{"agentId": agentID})
}

func (q *GatewayQueries) AgentsCreate(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "agents.create", params)
}

func (q *GatewayQueries) AgentsDelete(ctx context.Context, agentID string) (any, error) {
	return q.requester.Request(ctx, "agents.delete", map[string]any{"agentId": agentID})
}

func (q *GatewayQueries) AgentsUpdate(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "agents.update", body)
}

func (q *GatewayQueries) AgentFilesList(ctx context.Context, agentID string) (any, error) {
	return q.requester.Request(ctx, "agents.files.list", map[string]any{"agentId": agentID})
}

func (q *GatewayQueries) AgentFilesSet(ctx context.Context, agentID string, name string, content string) (any, error) {
	return q.requester.Request(ctx, "agents.files.set", map[string]any{
		"agentId": agentID,
		"name":    name,
		"content": content,
	})
}

func (q *GatewayQueries) AgentFilesGet(ctx context.Context, agentID string, name string) (any, error) {
	return q.requester.Request(ctx, "agents.files.get", map[string]any{
		"agentId": agentID,
		"name":    name,
	})
}

func (q *GatewayQueries) ToolsCatalog(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "tools.catalog", body)
}

func (q *GatewayQueries) SkillsStatus(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "skills.status", params)
}

func (q *GatewayQueries) SkillsUpdate(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "skills.update", body)
}

func (q *GatewayQueries) SkillsInstall(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "skills.install", body)
}

func (q *GatewayQueries) SkillsSearch(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "skills.search", body)
}

func (q *GatewayQueries) SkillsDetail(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "skills.detail", body)
}

func (q *GatewayQueries) SkillsBins(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "skills.bins", map[string]any{})
}

func (q *GatewayQueries) DevicePairList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "device.pair.list", map[string]any{})
}

func (q *GatewayQueries) DevicePairApprove(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "device.pair.approve", body)
}

func (q *GatewayQueries) DevicePairReject(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "device.pair.reject", body)
}

func (q *GatewayQueries) DevicePairRemove(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "device.pair.remove", body)
}

func (q *GatewayQueries) DeviceTokenRotate(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "device.token.rotate", body)
}

func (q *GatewayQueries) DeviceTokenRevoke(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "device.token.revoke", body)
}

func (q *GatewayQueries) CronList(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "cron.list", params)
}

func (q *GatewayQueries) CronAdd(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "cron.add", body)
}

func (q *GatewayQueries) CronUpdate(ctx context.Context, jobID string, patch map[string]any) (any, error) {
	return q.requester.Request(ctx, "cron.update", map[string]any{
		"id":    jobID,
		"patch": patch,
	})
}

func (q *GatewayQueries) CronRemove(ctx context.Context, jobID string) (any, error) {
	return q.requester.Request(ctx, "cron.remove", map[string]any{"id": jobID})
}

func (q *GatewayQueries) CronRun(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "cron.run", params)
}

func (q *GatewayQueries) CronRuns(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "cron.runs", params)
}

func (q *GatewayQueries) CronStatus(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "cron.status", map[string]any{})
}

func (q *GatewayQueries) UsageCost(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "usage.cost", params)
}

func (q *GatewayQueries) UsageStatus(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "usage.status", map[string]any{})
}

func (q *GatewayQueries) SessionsUsage(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.usage", params)
}

func (q *GatewayQueries) SessionsUsageLogs(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.usage.logs", params)
}

func (q *GatewayQueries) SessionsUsageTimeseries(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.usage.timeseries", params)
}

func (q *GatewayQueries) ChannelsStatus(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "channels.status", params)
}

func (q *GatewayQueries) ChannelsLogout(ctx context.Context, channelID string) (any, error) {
	return q.requester.Request(ctx, "channels.logout", map[string]any{"channel": channelID})
}

func (q *GatewayQueries) DeckPluginsList(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.plugins.list", params)
}

func (q *GatewayQueries) DeckAgentsDetail(ctx context.Context, agentID string) (any, error) {
	return q.requester.Request(ctx, "deck.agents.detail", map[string]any{"agentId": agentID})
}

func (q *GatewayQueries) DeckAgentsSkillsGet(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.agents.skills.get", body)
}

func (q *GatewayQueries) DeckAgentsSkillsSet(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.agents.skills.set", body)
}

func (q *GatewayQueries) DeckAgentsSubagentsGet(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.agents.subagents.get", body)
}

func (q *GatewayQueries) DeckAgentsSubagentsSet(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.agents.subagents.set", body)
}

func (q *GatewayQueries) DeckAgentsToolPolicyPreview(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.agents.toolPolicy.preview", body)
}

func (q *GatewayQueries) DeckAgentsSystemPromptPreview(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.agents.systemPrompt.preview", body)
}

func (q *GatewayQueries) DeckAgentsEventStreamsGet(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.agents.eventStreams.get", body)
}

func (q *GatewayQueries) DeckAgentsEventStreamsSet(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.agents.eventStreams.set", body)
}

func (q *GatewayQueries) DeckCommandsDiscover(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.commands.discover", body)
}

func (q *GatewayQueries) ToolsEffective(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "tools.effective", body)
}

func (q *GatewayQueries) ExecApprovalList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "exec.approval.list", map[string]any{})
}

func (q *GatewayQueries) ExecApprovalsGet(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "exec.approvals.get", map[string]any{})
}

func (q *GatewayQueries) ExecApprovalResolve(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "exec.approval.resolve", body)
}

func (q *GatewayQueries) ExecApprovalsSet(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "exec.approvals.set", body)
}

func (q *GatewayQueries) PluginApprovalList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "plugin.approval.list", map[string]any{})
}

func (q *GatewayQueries) PluginApprovalResolve(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "plugin.approval.resolve", body)
}

func (q *GatewayQueries) DeckIdentityList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "deck.identity.list", map[string]any{})
}

func (q *GatewayQueries) DeckIdentityLink(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.identity.link", body)
}

func (q *GatewayQueries) DeckIdentityUnlink(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.identity.unlink", body)
}

func (q *GatewayQueries) DeckRoutingList(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.routing.list", params)
}

func (q *GatewayQueries) DeckRoutingAdd(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.routing.add", body)
}

func (q *GatewayQueries) DeckRoutingRemove(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.routing.remove", body)
}

func (q *GatewayQueries) DeckRoutingValidate(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.routing.validate", body)
}

func (q *GatewayQueries) DeckRoutingSimulate(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.routing.simulate", body)
}

func (q *GatewayQueries) DeckSubagentsList(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.subagents.list", params)
}

func (q *GatewayQueries) DeckSubagentsKill(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.subagents.kill", body)
}

func (q *GatewayQueries) DeckSubagentsLineage(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.subagents.lineage", body)
}

func (q *GatewayQueries) DeckSubagentsSteer(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.subagents.steer", body)
}

func (q *GatewayQueries) DeckThreadsList(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.threads.list", params)
}

func (q *GatewayQueries) LogsTail(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "logs.tail", params)
}

func (q *GatewayQueries) SessionsDelete(ctx context.Context, sessionKey string) (any, error) {
	return q.requester.Request(ctx, "sessions.delete", map[string]any{"key": sessionKey})
}

func (q *GatewayQueries) SessionsGet(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.get", params)
}

func (q *GatewayQueries) SessionsListRaw(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.list", params)
}

func (q *GatewayQueries) ChatHistory(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "chat.history", params)
}

func (q *GatewayQueries) DoctorMemoryStatus(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "doctor.memory.status", map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryDreamDiary(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "doctor.memory.dreamDiary", map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryBackfillDreamDiary(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "doctor.memory.backfillDreamDiary", map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryResetDreamDiary(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "doctor.memory.resetDreamDiary", map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryResetGroundedShortTerm(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "doctor.memory.resetGroundedShortTerm", map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryRepairDreamingArtifacts(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "doctor.memory.repairDreamingArtifacts", map[string]any{})
}

func (q *GatewayQueries) DoctorMemoryDedupeDreamDiary(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "doctor.memory.dedupeDreamDiary", map[string]any{})
}

func (q *GatewayQueries) SessionsPreview(ctx context.Context, keys []string) (any, error) {
	return q.requester.Request(ctx, "sessions.preview", map[string]any{"keys": keys})
}

func (q *GatewayQueries) SessionsReset(ctx context.Context, sessionKey string, reason string) (any, error) {
	return q.requester.Request(ctx, "sessions.reset", map[string]any{
		"key":    sessionKey,
		"reason": reason,
	})
}

func (q *GatewayQueries) SessionsClear(ctx context.Context, sessionKey string) (any, error) {
	return q.requester.Request(ctx, "sessions.clear", map[string]any{"key": sessionKey})
}

func (q *GatewayQueries) SessionsPatch(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.patch", body)
}

func (q *GatewayQueries) SessionsCreate(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.create", params)
}

func (q *GatewayQueries) SessionsSend(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.send", params)
}

func (q *GatewayQueries) SessionsAbort(ctx context.Context, params map[string]any) (any, error) {
	return q.requester.Request(ctx, "sessions.abort", params)
}

func (q *GatewayQueries) SessionsCompact(ctx context.Context, sessionKey string) (any, error) {
	return q.requester.Request(ctx, "sessions.compact", map[string]any{"key": sessionKey})
}

func (q *GatewayQueries) SessionsCompactionList(ctx context.Context, sessionKey string) (any, error) {
	return q.requester.Request(ctx, "sessions.compaction.list", map[string]any{"key": sessionKey})
}

func (q *GatewayQueries) SessionsCompactionBranch(ctx context.Context, sessionKey string, checkpointID string) (any, error) {
	return q.requester.Request(ctx, "sessions.compaction.branch", map[string]any{
		"key":          sessionKey,
		"checkpointId": checkpointID,
	})
}

func (q *GatewayQueries) SessionsCompactionRestore(ctx context.Context, sessionKey string, checkpointID string) (any, error) {
	return q.requester.Request(ctx, "sessions.compaction.restore", map[string]any{
		"key":          sessionKey,
		"checkpointId": checkpointID,
	})
}

func (q *GatewayQueries) SessionsSteer(ctx context.Context, sessionKey string, message string) (any, error) {
	return q.requester.Request(ctx, "sessions.steer", map[string]any{
		"key":     sessionKey,
		"message": message,
	})
}

func (q *GatewayQueries) CommandsList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "commands.list", map[string]any{})
}

func (q *GatewayQueries) NodeList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "node.list", map[string]any{})
}

func (q *GatewayQueries) NodeDescribe(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.describe", body)
}

func (q *GatewayQueries) NodeRename(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.rename", body)
}

func (q *GatewayQueries) NodeInvoke(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.invoke", body)
}

func (q *GatewayQueries) NodePendingEnqueue(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.pending.enqueue", body)
}

func (q *GatewayQueries) NodePairList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "node.pair.list", map[string]any{})
}

func (q *GatewayQueries) NodePairRequest(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.pair.request", body)
}

func (q *GatewayQueries) NodePairApprove(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.pair.approve", body)
}

func (q *GatewayQueries) NodePairReject(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.pair.reject", body)
}

func (q *GatewayQueries) NodePairVerify(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "node.pair.verify", body)
}

func (q *GatewayQueries) ModelsList(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "models.list", map[string]any{})
}

func (q *GatewayQueries) ModelsConfigured(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "models.configured", map[string]any{})
}

func (q *GatewayQueries) ModelsCatalogProviders(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "models.catalog.providers", map[string]any{})
}

func (q *GatewayQueries) DeckAuthOverview(ctx context.Context) (any, error) {
	return q.requester.Request(ctx, "deck.auth.overview", map[string]any{})
}

func (q *GatewayQueries) DeckAuthProbe(ctx context.Context, body map[string]any) (any, error) {
	return q.requester.Request(ctx, "deck.auth.probe", body)
}
