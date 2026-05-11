package openclaw

import (
	"context"
	"testing"
)

type stubAdapterRequester struct {
	t       *testing.T
	payload map[string]any
	errs    map[string]error
}

func (s *stubAdapterRequester) Request(_ context.Context, method string, params map[string]any) (any, error) {
	if err := s.errs[method]; err != nil {
		return nil, err
	}
	switch method {
	case "gateway.describe":
		return s.payload["gateway.describe"], nil
	case "health":
		return map[string]any{"ok": true}, nil
	case "agents.list":
		return s.payload["agents.list"], nil
	case "agents.create":
		return s.payload["agents.create"], nil
	case "agents.delete":
		return s.payload["agents.delete"], nil
	case "agents.update":
		return s.payload["agents.update"], nil
	case "agents.files.list":
		return s.payload["agents.files.list"], nil
	case "agents.files.set":
		return s.payload["agents.files.set"], nil
	case "agents.files.get":
		return s.payload["agents.files.get"], nil
	case "agent.identity.get":
		return s.payload["agent.identity.get"], nil
	case "tools.catalog":
		return s.payload["tools.catalog"], nil
	case "skills.status":
		return s.payload["skills.status"], nil
	case "skills.update":
		return s.payload["skills.update"], nil
	case "skills.install":
		return s.payload["skills.install"], nil
	case "skills.search":
		return s.payload["skills.search"], nil
	case "skills.detail":
		return s.payload["skills.detail"], nil
	case "skills.bins":
		return s.payload["skills.bins"], nil
	case "cron.list":
		return s.payload["cron.list"], nil
	case "cron.add":
		return s.payload["cron.add"], nil
	case "cron.update":
		return s.payload["cron.update"], nil
	case "cron.remove":
		return s.payload["cron.remove"], nil
	case "cron.run":
		return s.payload["cron.run"], nil
	case "cron.runs":
		return s.payload["cron.runs"], nil
	case "cron.status":
		return s.payload["cron.status"], nil
	case "usage.cost":
		return s.payload["usage.cost"], nil
	case "usage.status":
		return s.payload["usage.status"], nil
	case "channels.status":
		return s.payload["channels.status"], nil
	case "channels.logout":
		return s.payload["channels.logout"], nil
	case "chat.history":
		return s.payload["chat.history"], nil
	case "doctor.memory.status":
		return s.payload["doctor.memory.status"], nil
	case "doctor.memory.dreamDiary":
		return s.payload["doctor.memory.dreamDiary"], nil
	case "doctor.memory.backfillDreamDiary":
		return s.payload["doctor.memory.backfillDreamDiary"], nil
	case "doctor.memory.resetDreamDiary":
		return s.payload["doctor.memory.resetDreamDiary"], nil
	case "doctor.memory.resetGroundedShortTerm":
		return s.payload["doctor.memory.resetGroundedShortTerm"], nil
	case "doctor.memory.repairDreamingArtifacts":
		return s.payload["doctor.memory.repairDreamingArtifacts"], nil
	case "doctor.memory.dedupeDreamDiary":
		return s.payload["doctor.memory.dedupeDreamDiary"], nil
	case "deck.plugins.list":
		return s.payload["deck.plugins.list"], nil
	case "deck.agents.detail":
		return s.payload["deck.agents.detail"], nil
	case "deck.agents.skills.get":
		return s.payload["deck.agents.skills.get"], nil
	case "deck.agents.skills.set":
		return s.payload["deck.agents.skills.set"], nil
	case "deck.agents.subagents.get":
		return s.payload["deck.agents.subagents.get"], nil
	case "deck.agents.subagents.set":
		return s.payload["deck.agents.subagents.set"], nil
	case "deck.agents.modelPolicy.get":
		return s.payload["deck.agents.modelPolicy.get"], nil
	case "deck.agents.modelPolicy.set":
		return s.payload["deck.agents.modelPolicy.set"], nil
	case "deck.agents.toolPolicy.preview":
		return s.payload["deck.agents.toolPolicy.preview"], nil
	case "deck.agents.systemPrompt.preview":
		return s.payload["deck.agents.systemPrompt.preview"], nil
	case "deck.agents.eventStreams.get":
		return s.payload["deck.agents.eventStreams.get"], nil
	case "deck.agents.eventStreams.set":
		return s.payload["deck.agents.eventStreams.set"], nil
	case "deck.commands.discover":
		return s.payload["deck.commands.discover"], nil
	case "tools.effective":
		return s.payload["tools.effective"], nil
	case "exec.approval.list":
		return s.payload["exec.approval.list"], nil
	case "exec.approvals.get":
		return s.payload["exec.approvals.get"], nil
	case "exec.approval.resolve":
		return s.payload["exec.approval.resolve"], nil
	case "exec.approvals.set":
		return s.payload["exec.approvals.set"], nil
	case "plugin.approval.list":
		return s.payload["plugin.approval.list"], nil
	case "plugin.approval.resolve":
		return s.payload["plugin.approval.resolve"], nil
	case "deck.identity.list":
		return s.payload["deck.identity.list"], nil
	case "deck.identity.link":
		return s.payload["deck.identity.link"], nil
	case "deck.identity.unlink":
		return s.payload["deck.identity.unlink"], nil
	case "deck.routing.list":
		return s.payload["deck.routing.list"], nil
	case "deck.routing.add":
		return s.payload["deck.routing.add"], nil
	case "deck.routing.remove":
		return s.payload["deck.routing.remove"], nil
	case "deck.routing.validate":
		return s.payload["deck.routing.validate"], nil
	case "deck.routing.simulate":
		return s.payload["deck.routing.simulate"], nil
	case "deck.subagents.list":
		return s.payload["deck.subagents.list"], nil
	case "deck.subagents.kill":
		return s.payload["deck.subagents.kill"], nil
	case "deck.subagents.lineage":
		return s.payload["deck.subagents.lineage"], nil
	case "deck.subagents.steer":
		return s.payload["deck.subagents.steer"], nil
	case "deck.threads.list":
		return s.payload["deck.threads.list"], nil
	case "logs.tail":
		return s.payload["logs.tail"], nil
	case "sessions.delete":
		return s.payload["sessions.delete"], nil
	case "sessions.preview":
		return s.payload["sessions.preview"], nil
	case "sessions.reset":
		return s.payload["sessions.reset"], nil
	case "sessions.clear":
		return s.payload["sessions.clear"], nil
	case "sessions.patch":
		return s.payload["sessions.patch"], nil
	case "sessions.create":
		return s.payload["sessions.create"], nil
	case "sessions.send":
		return s.payload["sessions.send"], nil
	case "sessions.abort":
		return s.payload["sessions.abort"], nil
	case "sessions.compact":
		return s.payload["sessions.compact"], nil
	case "sessions.compaction.list":
		return s.payload["sessions.compaction.list"], nil
	case "sessions.compaction.branch":
		return s.payload["sessions.compaction.branch"], nil
	case "sessions.compaction.restore":
		return s.payload["sessions.compaction.restore"], nil
	case "sessions.steer":
		return s.payload["sessions.steer"], nil
	case "config.get":
		return s.payload["config.get"], nil
	case "config.patch":
		return s.payload["config.patch"], nil
	case "config.apply":
		return s.payload["config.apply"], nil
	case "sessions.list":
		return s.payload["sessions.list"], nil
	case "sessions.get":
		return s.payload["sessions.get"], nil
	default:
		s.t.Fatalf("unexpected method: %s", method)
		return nil, nil
	}
}

func (s *stubAdapterRequester) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	paramsMap, err := typedParamsToMap(params)
	if err != nil {
		return nil, err
	}
	return s.Request(ctx, method, paramsMap)
}

func TestAdapter_ExposesCapabilityStatusAndSessionQueries(t *testing.T) {
	requester := &stubAdapterRequester{
		t: t,
		payload: map[string]any{
			"gateway.describe": map[string]any{
				"schemaVersion": "3.1",
				"methods":       map[string]any{"health": map[string]any{}},
				"events":        map[string]any{"runtime.status": map[string]any{}},
			},
			"config.get": map[string]any{
				"raw": `{"models":{"providers":{}}}`,
			},
			"config.patch": map[string]any{
				"ok": true,
			},
			"config.apply": map[string]any{
				"ok": true,
			},
			"agents.list": map[string]any{
				"agents": []any{map[string]any{
					"id":   "main",
					"name": "Main",
				}},
			},
			"agent.identity.get": map[string]any{
				"agentId": "main",
				"name":    "Main",
			},
			"agents.create": map[string]any{"id": "ops"},
			"agents.delete": map[string]any{"ok": true},
			"agents.update": map[string]any{"ok": true},
			"agents.files.list": map[string]any{
				"agentId":   "main",
				"workspace": "/tmp/openclaw",
				"files": []any{map[string]any{
					"missing": false,
					"name":    "AGENTS.md",
					"path":    "AGENTS.md",
				}},
			},
			"agents.files.set": map[string]any{
				"agentId":   "main",
				"ok":        true,
				"workspace": "/tmp/openclaw",
				"file": map[string]any{
					"missing": false,
					"name":    "AGENTS.md",
					"path":    "AGENTS.md",
				},
			},
			"agents.files.get": map[string]any{
				"agentId":   "main",
				"workspace": "/tmp/openclaw",
				"file": map[string]any{
					"content": "hello",
					"missing": false,
					"name":    "notes/README.md",
					"path":    "notes/README.md",
				},
			},
			"tools.catalog": map[string]any{
				"tools": []any{map[string]any{"id": "search"}},
			},
			"skills.status":  map[string]any{"ok": true},
			"skills.update":  map[string]any{"ok": true},
			"skills.install": map[string]any{"ok": true},
			"skills.search":  map[string]any{"ok": true},
			"skills.detail":  map[string]any{"ok": true},
			"skills.bins":    map[string]any{"ok": true},
			"cron.list":      map[string]any{"items": []any{}},
			"cron.add":       map[string]any{"ok": true},
			"cron.update":    map[string]any{"ok": true},
			"cron.remove":    map[string]any{"ok": true},
			"cron.run":       map[string]any{"ok": true},
			"cron.runs":      map[string]any{"items": []any{}},
			"cron.status":    map[string]any{"ok": true},
			"usage.cost":     map[string]any{"days": 7},
			"usage.status":   map[string]any{"providers": []any{}},
			"channels.status": map[string]any{
				"channelOrder": []string{"wechat"},
			},
			"channels.logout":                       map[string]any{"ok": true},
			"chat.history":                          map[string]any{"messages": []any{}},
			"doctor.memory.status":                  map[string]any{"entries": []any{}},
			"doctor.memory.dreamDiary":              map[string]any{"ok": true},
			"doctor.memory.backfillDreamDiary":      map[string]any{"ok": true},
			"doctor.memory.resetDreamDiary":         map[string]any{"ok": true},
			"doctor.memory.resetGroundedShortTerm":  map[string]any{"ok": true},
			"doctor.memory.repairDreamingArtifacts": map[string]any{"ok": true},
			"doctor.memory.dedupeDreamDiary":        map[string]any{"ok": true},
			"deck.plugins.list":                     map[string]any{"plugins": []any{}},
			"deck.agents.detail":                    map[string]any{"agentId": "main"},
			"deck.agents.skills.get":                map[string]any{"skills": []any{}},
			"deck.agents.skills.set":                map[string]any{"ok": true},
			"deck.agents.subagents.get":             map[string]any{"subagents": []any{}},
			"deck.agents.subagents.set":             map[string]any{"ok": true},
			"deck.agents.modelPolicy.get":           map[string]any{"policies": []any{}, "configuredModels": []any{}, "unsupported": []any{}, "configHash": "hash-1"},
			"deck.agents.modelPolicy.set":           map[string]any{"ok": true, "configHash": "hash-2"},
			"deck.agents.toolPolicy.preview":        map[string]any{"ok": true},
			"deck.agents.systemPrompt.preview":      map[string]any{"ok": true},
			"deck.agents.eventStreams.get":          map[string]any{"ok": true},
			"deck.agents.eventStreams.set":          map[string]any{"ok": true},
			"deck.commands.discover":                map[string]any{"groups": []any{}},
			"tools.effective":                       map[string]any{"tools": []any{}},
			"exec.approval.list":                    []any{},
			"exec.approvals.get":                    map[string]any{"file": map[string]any{}},
			"exec.approval.resolve":                 map[string]any{"ok": true},
			"exec.approvals.set":                    map[string]any{"ok": true},
			"plugin.approval.list":                  []any{},
			"plugin.approval.resolve":               map[string]any{"ok": true},
			"deck.identity.list":                    map[string]any{"links": []any{}},
			"deck.identity.link":                    map[string]any{"ok": true},
			"deck.identity.unlink":                  map[string]any{"ok": true},
			"deck.routing.list":                     map[string]any{"bindings": []any{}},
			"deck.routing.add":                      map[string]any{"ok": true},
			"deck.routing.remove":                   map[string]any{"ok": true},
			"deck.routing.validate":                 map[string]any{"ok": true},
			"deck.routing.simulate":                 map[string]any{"tiers": []any{}},
			"deck.subagents.list":                   map[string]any{"runs": []any{}},
			"deck.subagents.kill":                   map[string]any{"ok": true},
			"deck.subagents.lineage":                map[string]any{"nodes": []any{}},
			"deck.subagents.steer":                  map[string]any{"ok": true},
			"deck.threads.list":                     map[string]any{"threads": []any{}},
			"logs.tail":                             map[string]any{"lines": []string{"hello"}},
			"sessions.delete":                       map[string]any{"ok": true, "key": "session-1"},
			"sessions.list": map[string]any{
				"sessions": []any{map[string]any{
					"key":          "session-1",
					"agentId":      "main",
					"derivedTitle": "Test Session",
					"status":       "running",
				}},
			},
			"sessions.get": map[string]any{
				"messages": []any{map[string]any{
					"id":   "msg-1",
					"role": "assistant",
					"content": []any{map[string]any{
						"type": "text",
						"text": "hello",
					}},
				}},
			},
		},
		errs: map[string]error{},
	}

	adapter := NewAdapter(requester)

	capability, err := adapter.CapabilitySummary().Load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if capability.SchemaVersion != "3.1" {
		t.Fatalf("unexpected capability summary: %#v", capability)
	}

	status, err := adapter.GatewayStatus().Load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !status.Connected {
		t.Fatalf("unexpected gateway status: %#v", status)
	}

	configPayload, err := adapter.GatewayQueries().ConfigGet(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if configPayload.Raw != `{"models":{"providers":{}}}` {
		t.Fatalf("unexpected config payload: %#v", configPayload)
	}

	if _, err := adapter.GatewayQueries().ConfigPatch(context.Background(), `{"x":1}`, "h1", "note"); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ConfigApply(context.Background(), `{"x":1}`, "h1"); err != nil {
		t.Fatal(err)
	}
	agentsPayload, err := adapter.GatewayQueries().AgentsList(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(agentsPayload.Agents) != 1 || agentsPayload.Agents[0].Id != "main" {
		t.Fatalf("unexpected agents payload: %#v", agentsPayload)
	}
	identityPayload, err := adapter.GatewayQueries().AgentIdentityGet(context.Background(), "main")
	if err != nil {
		t.Fatal(err)
	}
	if identityPayload.AgentId != "main" {
		t.Fatalf("unexpected agent identity payload: %#v", identityPayload)
	}
	if _, err := adapter.GatewayQueries().AgentsCreate(context.Background(), map[string]any{"name": "Ops"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().AgentsDelete(context.Background(), "ops", false); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().AgentsUpdate(context.Background(), map[string]any{"agentId": "main", "name": "Renamed Main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().AgentFilesList(context.Background(), "main"); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().AgentFilesSet(context.Background(), "main", "AGENTS.md", "hello"); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().AgentFilesGet(context.Background(), "main", "notes/README.md"); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ToolsCatalog(context.Background(), map[string]any{"agentId": "main", "includePlugins": false}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().SkillsStatus(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().SkillsUpdate(context.Background(), map[string]any{"skillKey": "demo", "enabled": false}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().SkillsInstall(context.Background(), map[string]any{"name": "foo"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().SkillsSearch(context.Background(), map[string]any{"query": "tool"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().SkillsDetail(context.Background(), map[string]any{"slug": "demo"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().SkillsBins(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().CronList(context.Background(), map[string]any{"limit": 10}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().CronAdd(context.Background(), map[string]any{"name": "Nightly"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().CronUpdate(context.Background(), "job-1", map[string]any{"enabled": false}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().CronRemove(context.Background(), "job-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().CronRun(context.Background(), map[string]any{"id": "job-1", "mode": "force"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().CronRuns(context.Background(), map[string]any{"jobId": "job-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().CronStatus(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().UsageCost(context.Background(), map[string]any{"days": 14}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().UsageStatus(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ChannelsStatus(context.Background(), map[string]any{"probe": true}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ChannelsLogout(context.Background(), "wechat"); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckPluginsList(context.Background(), map[string]any{"capability": "all"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsDetail(context.Background(), "main"); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsSkillsGet(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsSkillsSet(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsSubagentsGet(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsSubagentsSet(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsModelPolicyGet(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsModelPolicySet(context.Background(), map[string]any{
		"target":   map[string]any{"kind": "agent-model", "key": "agent", "agentId": "main"},
		"clear":    true,
		"baseHash": "hash-1",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsToolPolicyPreview(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsSystemPromptPreview(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsEventStreamsGet(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckAgentsEventStreamsSet(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckCommandsDiscover(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ToolsEffective(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ExecApprovalList(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ExecApprovalsGet(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ExecApprovalResolve(context.Background(), map[string]any{"id": "ap-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ExecApprovalsSet(context.Background(), map[string]any{"baseHash": "h1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().PluginApprovalList(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().PluginApprovalResolve(context.Background(), map[string]any{"id": "plug-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckIdentityList(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckIdentityLink(context.Background(), map[string]any{"canonical": "user:1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckIdentityUnlink(context.Background(), map[string]any{"canonical": "user:1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckRoutingList(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckRoutingAdd(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckRoutingRemove(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckRoutingValidate(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckRoutingSimulate(context.Background(), map[string]any{"channel": "telegram"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckSubagentsList(context.Background(), map[string]any{"status": "active"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckSubagentsKill(context.Background(), map[string]any{"runId": "run-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckSubagentsLineage(context.Background(), map[string]any{"sessionKey": "sess-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckSubagentsSteer(context.Background(), map[string]any{"runId": "run-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DeckThreadsList(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().LogsTail(context.Background(), map[string]any{"limit": 1}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ConfigGetWithParams(context.Background(), map[string]any{"path": "agents.defaults.workspace"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().SessionsDelete(context.Background(), "session-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().HealthWithParams(context.Background(), map[string]any{"agentId": "main"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().ChatHistory(context.Background(), map[string]any{"sessionKey": "session-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DoctorMemoryStatus(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DoctorMemoryDreamDiary(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DoctorMemoryBackfillDreamDiary(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DoctorMemoryResetDreamDiary(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DoctorMemoryResetGroundedShortTerm(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DoctorMemoryRepairDreamingArtifacts(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := adapter.GatewayQueries().DoctorMemoryDedupeDreamDiary(context.Background()); err != nil {
		t.Fatal(err)
	}

	describePayload, err := adapter.GatewayQueries().Describe(context.Background(), false)
	if err != nil {
		t.Fatal(err)
	}
	if describePayload.SchemaVersion != "3.1" {
		t.Fatalf("unexpected gateway describe payload: %#v", describePayload)
	}

	sessions, err := adapter.SessionQueries().ListSessions(context.Background(), DefaultRuntimeID)
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 || sessions[0].Key != "session-1" {
		t.Fatalf("unexpected sessions: %#v", sessions)
	}

	subscriptions := adapter.SessionSubscriptions()
	if subscriptions == nil {
		t.Fatal("expected session subscriptions façade")
	}
}

type stubSubscriptionController struct {
	subscribed   []string
	unsubscribed []string
}

func (s *stubSubscriptionController) SubscribeSession(_ context.Context, key string) error {
	s.subscribed = append(s.subscribed, key)
	return nil
}

func (s *stubSubscriptionController) UnsubscribeSession(_ context.Context, key string) error {
	s.unsubscribed = append(s.unsubscribed, key)
	return nil
}

func TestAdapter_SessionSubscriptionsDelegateToController(t *testing.T) {
	controller := &stubSubscriptionController{}
	adapter := NewAdapterWithRealtime(&stubAdapterRequester{t: t, payload: map[string]any{}, errs: map[string]error{}}, controller)

	if err := adapter.SessionSubscriptions().SubscribeSession(context.Background(), "session-1"); err != nil {
		t.Fatal(err)
	}
	if err := adapter.SessionSubscriptions().UnsubscribeSession(context.Background(), "session-1"); err != nil {
		t.Fatal(err)
	}

	if len(controller.subscribed) != 1 || controller.subscribed[0] != "session-1" {
		t.Fatalf("unexpected subscribe delegation: %#v", controller.subscribed)
	}
	if len(controller.unsubscribed) != 1 || controller.unsubscribed[0] != "session-1" {
		t.Fatalf("unexpected unsubscribe delegation: %#v", controller.unsubscribed)
	}
}

func TestAdapter_CachesHelperSurfaces(t *testing.T) {
	adapter := NewAdapter(&stubAdapterRequester{t: t, payload: map[string]any{}, errs: map[string]error{}})

	if first, second := adapter.GatewayQueries(), adapter.GatewayQueries(); first != second {
		t.Fatal("expected gateway queries helper to be cached")
	}
	if first, second := adapter.SessionQueries(), adapter.SessionQueries(); first != second {
		t.Fatal("expected session queries helper to be cached")
	}
	if first, second := adapter.SessionCommands(), adapter.SessionCommands(); first != second {
		t.Fatal("expected session commands helper to be cached")
	}
	if first, second := adapter.CapabilitySummary(), adapter.CapabilitySummary(); first != second {
		t.Fatal("expected capability summary helper to be cached")
	}
	if first, second := adapter.GatewayStatus(), adapter.GatewayStatus(); first != second {
		t.Fatal("expected gateway status helper to be cached")
	}
}
