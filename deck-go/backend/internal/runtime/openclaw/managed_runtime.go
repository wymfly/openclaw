package openclaw

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	runtimecoerce "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/coerce"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw/views"
	runtimeprojection "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection"
	runtimeregistry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
)

type ManagedRuntimeRegistrySurface interface {
	ListRuntimes(context.Context) ([]runtimeregistry.RuntimeSummary, error)
	GetRuntime(context.Context, string) (runtimeregistry.RuntimeSummary, bool, error)
	Replay(lastID int64) ([]events.Event, bool)
	SupportsRuntime(runtimeID string) bool
	Subscribe(context.Context) <-chan events.Event
}

type ManagedRuntimeSurface interface {
	RuntimeSurface
	ManagedRuntimeRegistrySurface
	GetSettings(context.Context) (deckapi.DeckGoSettingsResponse, error)
	UpdateSettingsFromConfig(context.Context, config.Settings) (deckapi.DeckGoSettingsSaveResponse, error)
	UpdateSettings(context.Context, deckapi.DeckGoSettings) (deckapi.DeckGoSettingsSaveResponse, error)
	TestConnection(context.Context, string, string) (map[string]any, error)
	TestLegacySettingsConnection(context.Context, string, string) (map[string]any, error)
	GetVersion(context.Context) (map[string]any, error)
	GetOnboardingStatus(context.Context) (map[string]any, error)
	TestOnboardingConnection(context.Context, string, string) (map[string]any, error)
	SaveOnboardingSettings(context.Context, string, string) (map[string]any, int, error)
	RuntimeGatewayStatusResponse() RuntimeGatewayActionResponse
	StartRuntimeGateway(context.Context) (RuntimeGatewayActionResponse, error)
	StopRuntimeGateway(context.Context) (RuntimeGatewayActionResponse, error)
	RestartRuntimeGateway(context.Context) (RuntimeGatewayActionResponse, error)
	BootstrapStatus(context.Context) (deckapi.DeckGoBootstrapStatusResponse, error)
	ListActivity(context.Context, string, int) ([]runtimeprojection.ActivityEventEntry, error)
	ListRuns(context.Context, string) ([]runtimeprojection.RunRecord, error)
	GetRun(context.Context, string, string) (runtimeprojection.RunRecord, []runtimeprojection.RunEventRow, bool, error)
	GetStats(context.Context, string) (runtimeprojection.MonitorStats, error)
	GetGatewayDescribe(context.Context, string, bool) (any, error)
	GetGatewayHealth(context.Context, string) (any, error)
	GetGatewayStatus(context.Context, string) (any, error)
	LoadGatewayStatus(context.Context) (GatewayStatusSummary, error)
	ListDevices(context.Context, string) (any, error)
	GetCurrentDeviceID(string) (string, error)
	ApproveDeviceRequest(context.Context, string, string) (any, error)
	RejectDeviceRequest(context.Context, string, string) (any, error)
	RemoveDevice(context.Context, string, string) (any, error)
	RotateDeviceToken(context.Context, string, string, string) (any, error)
	RevokeDeviceToken(context.Context, string, string, string) (any, error)
	GetConfig(context.Context, string) (any, error)
	PatchConfig(context.Context, string, map[string]any, string) (any, error)
	ApplyConfig(context.Context, string, string, string) (any, error)
	GetConfigSchema(context.Context, string) (any, error)
	LookupConfigSchema(context.Context, string, string) (any, error)
	ListAgents(context.Context, string) (any, error)
	GetAgent(context.Context, string, string) (any, bool, error)
	GetAgentIdentity(context.Context, string, string) (any, error)
	ListAgentFiles(context.Context, string, string) (any, error)
	GetAgentFile(context.Context, string, string, string) (any, error)
	CreateAgent(context.Context, string, map[string]any) (any, error)
	UpdateAgent(context.Context, string, string, map[string]any) (any, error)
	DeleteAgent(context.Context, string, string) (any, error)
	SetAgentFile(context.Context, string, string, string, string) (any, error)
	ListCommands(context.Context, string) (any, error)
	ToolsCatalog(context.Context, string, map[string]any) (any, error)
	GetUsage(context.Context, string) (any, error)
	ListCronJobs(context.Context, string, map[string]any) (any, error)
	AddCronJob(context.Context, string, map[string]any) (any, error)
	UpdateCronJob(context.Context, string, string, map[string]any) (any, error)
	RemoveCronJob(context.Context, string, string) (any, error)
	RunCronJob(context.Context, string, map[string]any) (any, error)
	ListCronRuns(context.Context, string, map[string]any) (any, error)
	GetCronStatus(context.Context, string) (any, error)
	DiscoverDeckCommands(context.Context, string, map[string]any) (any, error)
	GetDeckToolsEffective(context.Context, string, map[string]any) (any, error)
	ListDeckPlugins(context.Context, string, map[string]any) (any, error)
	GetDeckAgentDetail(context.Context, string, string) (any, error)
	RunDeckAgentAction(context.Context, string, string, map[string]any) (any, error)
	ListDeckIdentity(context.Context, string) (any, error)
	LinkDeckIdentity(context.Context, string, map[string]any) (any, error)
	UnlinkDeckIdentity(context.Context, string, map[string]any) (any, error)
	ListDeckRouting(context.Context, string, map[string]any) (any, error)
	AddDeckRouting(context.Context, string, map[string]any) (any, error)
	RemoveDeckRouting(context.Context, string, map[string]any) (any, error)
	ValidateDeckRouting(context.Context, string, map[string]any) (any, error)
	SimulateDeckRouting(context.Context, string, map[string]any) (any, error)
	ListDeckSubagents(context.Context, string, map[string]any) (any, error)
	KillDeckSubagent(context.Context, string, map[string]any) (any, error)
	GetDeckSubagentLineage(context.Context, string, map[string]any) (any, error)
	SteerDeckSubagent(context.Context, string, map[string]any) (any, error)
	ListDeckThreads(context.Context, string, map[string]any) (any, error)
	GetApprovals(context.Context, string) (any, error)
	ResolveApproval(context.Context, string, map[string]any) (any, error)
	ListPendingApprovals(context.Context, string) (any, error)
	SetApprovalPolicy(context.Context, string, map[string]any) (any, error)
	ListPluginApprovals(context.Context, string) (any, error)
	ResolvePluginApproval(context.Context, string, map[string]any) (any, error)
	GetMemoryHealth(context.Context, string) (any, error)
	RunMemoryDreamAction(context.Context, string, string) (any, error)
	ListNodes(context.Context, string) (any, error)
	RunNodeAction(context.Context, string, string, map[string]any) (any, error)
	ListNodePairing(context.Context, string) (any, error)
	RunNodePairAction(context.Context, string, string, map[string]any) (any, error)
	ListSkills(context.Context, string, map[string]any) (any, error)
	UpdateSkill(context.Context, string, string, map[string]any) (any, error)
	InstallSkill(context.Context, string, map[string]any) (any, error)
	RunSkillsHubAction(context.Context, string, map[string]any) (any, error)
	UpdateClawhubSkill(context.Context, string, map[string]any) (any, error)
	ListModels(context.Context, string) (any, error)
	GetModelAuthOverview(context.Context, string) (any, error)
	ListModelCatalogProviders(context.Context, string) (any, error)
	ListConfiguredModels(context.Context, string) (any, error)
	ProbeModelAuth(context.Context, string, map[string]any) (any, error)
	GetChannels(context.Context, string, map[string]any) (any, error)
	LogoutChannel(context.Context, string, string) (any, error)
	TestChannel(context.Context, string, string) (any, error)
	GetChannelThroughput(context.Context, string, string) (any, error)
	PatchChannel(context.Context, string, string, map[string]any) (any, error)
	ListSessionsWithParams(context.Context, map[string]any, string) ([]deckapi.DeckGoSessionMeta, error)
	Delete(context.Context, string) (deckapi.DeckGoSessionMutationResponse, error)
	Preview(context.Context, []string) (deckapi.DeckGoSessionsPreviewResponse, error)
	Reset(context.Context, string, string) (deckapi.DeckGoSessionMutationResponse, error)
	Clear(context.Context, string) (deckapi.DeckGoSessionMutationResponse, error)
	Patch(context.Context, string, map[string]any) (deckapi.DeckGoSessionMutationResponse, error)
	Create(context.Context, map[string]any) (deckapi.DeckGoSessionCreateResponse, error)
	Send(context.Context, map[string]any) (deckapi.DeckGoSessionSendResponse, error)
	Abort(context.Context, map[string]any) (deckapi.DeckGoSessionAbortResponse, error)
	Compact(context.Context, string) (any, error)
	CompactionList(context.Context, string) (any, error)
	CompactionBranch(context.Context, string, string) (any, error)
	CompactionRestore(context.Context, string, string) (any, error)
	Steer(context.Context, string, string) (any, error)
	CreateSession(context.Context, string, string, string, string, string, string) (deckapi.DeckGoSessionCreateResponse, error)
	SendMessage(context.Context, string, string, string, []map[string]any, string) error
	AbortRun(context.Context, string, string, string) error
	CompactSession(context.Context, string, string, string) error
	DeleteSession(context.Context, string, string, string) error
	ResetSession(context.Context, string, string, string, string) error
	ClearSession(context.Context, string, string, string) error
	PatchSession(context.Context, string, string, map[string]any, string) error
	Describe(context.Context, bool) (any, error)
	Health(context.Context) (any, error)
	Status(context.Context) (any, error)
	ConfigSchemaLookup(context.Context, string) (any, error)
	ConfigGet(context.Context) (any, error)
	ConfigPatch(context.Context, string, string, string) (any, error)
	ConfigApply(context.Context, string, string) (any, error)
	ChatHistory(context.Context, map[string]any) (any, error)
	UsageCost(context.Context, map[string]any) (any, error)
	TailLogs(context.Context, map[string]any) (any, error)
	SubscribeSession(context.Context, string) error
	UnsubscribeSession(context.Context, string) error
	RunCompactionAction(context.Context, map[string]any) (any, int, error)
	SteerSession(context.Context, string, string) (any, int, error)
	GetUsageCost(context.Context, int) (any, error)
	GetUsageProviders(context.Context) (any, error)
	GetUsageSessions(context.Context, map[string]any) (any, error)
	GetUsageSessionLogs(context.Context, map[string]any) (any, error)
	GetUsageTimeseries(context.Context, map[string]any) (any, error)
	GetModelsConfig(context.Context) (any, error)
	PatchModelsConfig(context.Context, string, string, string) (any, error)
	GetModelUsageProviders(context.Context) (any, error)
	GetModelUsageCost(context.Context, int) (any, error)
	GetMedia(context.Context, string, bool) (AssetResponse, error)
	GetCanvasAsset(context.Context, string) (AssetResponse, error)
	HandleDeckCanvas(context.Context, map[string]any) (AssetResponse, error)
	ListDocs(context.Context, string, string) (map[string]any, error)
	GetDoc(context.Context, string) (any, bool, error)
	DeleteDoc(context.Context, string) (bool, error)
	ExtractDocs(context.Context, string) (map[string]any, int, error)
	BrowseMemory(context.Context, string, string, bool) (any, int, error)
	SearchMemory(context.Context, string, string, string) (any, int, error)
	ListBudgetRules(context.Context) (map[string]any, error)
	CreateBudgetRule(context.Context, BudgetCreateInput) (any, int, error)
	UpdateBudgetRule(context.Context, string, BudgetPatchInput) (any, bool, int, error)
	DeleteBudgetRule(context.Context, string) (bool, error)
	EvaluateBudgetRules(context.Context) (any, int, error)
	EventsSince(int64) ([]events.Event, bool)
	SubscribeStream() (<-chan events.Event, func())
	AgentFilesList(context.Context, string) (any, error)
	DoctorMemoryStatus(context.Context) (any, error)
	DoctorMemoryDreamDiary(context.Context) (any, error)
	DoctorMemoryBackfillDreamDiary(context.Context) (any, error)
	DoctorMemoryResetDreamDiary(context.Context) (any, error)
	DoctorMemoryResetGroundedShortTerm(context.Context) (any, error)
	DoctorMemoryRepairDreamingArtifacts(context.Context) (any, error)
	DoctorMemoryDedupeDreamDiary(context.Context) (any, error)
	GetTimelineWithParams(context.Context, string, string, int) (deckapi.DeckGoSessionDetailResponse, error)
	LogsTail(context.Context, map[string]any) (any, error)
	RuntimeAdapter() RuntimeSurface
	RuntimeRegistry() *runtimeregistry.Registry
	EventBus() *events.Bus
}

type ManagedRuntime struct {
	store        *config.Store
	facade       facade.RuntimeFacade
	lastStatusMu sync.RWMutex
	lastStatus   facade.RuntimeStatus
	adapter      RuntimeSurface
	registry     *runtimeregistry.Registry
	monitor      *runtimeprojection.MonitorQueries
	bus          *events.Bus
	bffViews     *views.Registry
}

var _ ManagedRuntimeSurface = (*ManagedRuntime)(nil)

func NewManagedRuntimeWithFacade(store *config.Store, runtimeFacade facade.RuntimeFacade, bus *events.Bus) *ManagedRuntime {
	requester, _ := runtimeFacade.(Requester)
	var adapter RuntimeSurface
	var capabilities runtimeregistry.CapabilityLoader
	if requester != nil {
		adapter = NewAdapterWithRealtime(requester, newRequestSessionController(requester))
		capabilities = adapter.CapabilitySummary()
	} else {
		provider := facadeConnectionProvider{runtimeFacade: runtimeFacade}
		direct := facadeDirectRequester{provider: provider}
		adapter = NewAdapterWithRealtime(direct, newRequestSessionController(direct))
	}
	managed := &ManagedRuntime{
		store:   store,
		facade:  runtimeFacade,
		adapter: adapter,
		monitor: runtimeprojection.NewMonitorQueries(bus),
		bus:     bus,
	}
	managed.registry = runtimeregistry.NewWithCapabilities(
		managedRuntimeStatusReader{owner: managed},
		capabilities,
		bus,
	)
	managed.bffViews = views.NewRegistry(
		func(ctx context.Context, params generated.GatewayBatchParams) (generated.GatewayBatchResult, error) {
			return managed.GatewayQueries().Batch(ctx, params)
		},
		func(ctx context.Context, method string, params any) (any, error) {
			return managed.GatewayQueries().RequestTypedRaw(ctx, method, params)
		},
		views.WithStateDir(resolveManagedRuntimeStateDir(store)),
	)
	return managed
}

func resolveManagedRuntimeStateDir(store *config.Store) string {
	if store == nil || strings.TrimSpace(store.Path()) == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(store.Path()), "managed-gateway-state")
}

type managedRuntimeStatusReader struct {
	owner *ManagedRuntime
}

func (r managedRuntimeStatusReader) LastStatus() facade.RuntimeStatus {
	if r.owner == nil {
		return facade.RuntimeStatus{}
	}
	return r.owner.LastStatus()
}

type facadeConnectionProvider struct {
	runtimeFacade facade.RuntimeFacade
}

func (p facadeConnectionProvider) GatewayConnection() (string, string, bool) {
	if p.runtimeFacade == nil {
		return "", "", false
	}
	conn, err := p.runtimeFacade.GatewayConnection(context.Background())
	if err != nil || strings.TrimSpace(conn.URL) == "" {
		return "", "", false
	}
	return conn.URL, conn.Token, true
}

type facadeDirectRequester struct {
	provider facadeConnectionProvider
}

func (r facadeDirectRequester) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	upstreamURL, token, ok := r.provider.GatewayConnection()
	if !ok {
		return nil, facade.ErrNotConfigured
	}
	return gateway.RequestDirect(ctx, upstreamURL, token, method, params)
}

func (r facadeDirectRequester) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	paramsMap, err := typedParamsToMap(params)
	if err != nil {
		return nil, err
	}
	return r.Request(ctx, method, paramsMap)
}

type requestSessionController struct {
	requester UntypedRequester
	mu        sync.Mutex
	counts    map[string]int
	lifecycle bool
}

func newRequestSessionController(requester UntypedRequester) *requestSessionController {
	return &requestSessionController{
		requester: requester,
		counts:    map[string]int{},
	}
}

func (c *requestSessionController) SubscribeSession(ctx context.Context, key string) error {
	if strings.TrimSpace(key) == "" {
		return nil
	}
	c.mu.Lock()
	alreadySubscribed := c.counts[key] > 0
	needsLifecycleSubscribe := !c.lifecycle
	c.mu.Unlock()
	if needsLifecycleSubscribe {
		if _, err := c.requester.Request(ctx, "sessions.subscribe", map[string]any{}); err != nil {
			return err
		}
	}
	if !alreadySubscribed {
		if _, err := c.requester.Request(ctx, "sessions.messages.subscribe", map[string]any{"key": key}); err != nil {
			return err
		}
	}
	c.mu.Lock()
	c.lifecycle = true
	c.counts[key]++
	c.mu.Unlock()
	return nil
}

func (c *requestSessionController) UnsubscribeSession(ctx context.Context, key string) error {
	if strings.TrimSpace(key) == "" {
		return nil
	}
	c.mu.Lock()
	count := c.counts[key]
	if count == 0 {
		c.mu.Unlock()
		return nil
	}
	if count > 1 {
		c.counts[key]--
		c.mu.Unlock()
		return nil
	}
	c.mu.Unlock()
	if _, err := c.requester.Request(ctx, "sessions.messages.unsubscribe", map[string]any{"key": key}); err != nil {
		return err
	}
	c.mu.Lock()
	delete(c.counts, key)
	needsLifecycleUnsubscribe := c.lifecycle && len(c.counts) == 0
	if needsLifecycleUnsubscribe {
		c.lifecycle = false
	}
	c.mu.Unlock()
	if needsLifecycleUnsubscribe {
		if _, err := c.requester.Request(ctx, "sessions.unsubscribe", map[string]any{}); err != nil {
			return err
		}
	}
	return nil
}

func (m *ManagedRuntime) Facade() facade.RuntimeFacade {
	if m == nil {
		return nil
	}
	return m.facade
}

func (m *ManagedRuntime) LastStatus() facade.RuntimeStatus {
	if m == nil {
		return facade.RuntimeStatus{}
	}
	m.lastStatusMu.RLock()
	defer m.lastStatusMu.RUnlock()
	return m.lastStatus
}

func (m *ManagedRuntime) RecordRuntimeStatus(status facade.RuntimeStatus) {
	m.setLastStatus(status)
}

func (m *ManagedRuntime) setLastStatus(status facade.RuntimeStatus) {
	if m == nil {
		return
	}
	m.lastStatusMu.Lock()
	m.lastStatus = status
	m.lastStatusMu.Unlock()
}

func (m *ManagedRuntime) RuntimeAdapter() RuntimeSurface {
	if m == nil {
		return nil
	}
	return m.adapter
}

func (m *ManagedRuntime) Close() error {
	if m == nil {
		return nil
	}
	closeable, ok := m.adapter.(interface{ Close() error })
	if !ok {
		return nil
	}
	return closeable.Close()
}

func (m *ManagedRuntime) CapabilitySummary() *CapabilitySummaryLoader {
	adapter := m.RuntimeAdapter()
	if adapter == nil {
		return nil
	}
	return adapter.CapabilitySummary()
}

func (m *ManagedRuntime) GatewayStatus() *GatewayStatusLoader {
	adapter := m.RuntimeAdapter()
	if adapter == nil {
		return nil
	}
	return adapter.GatewayStatus()
}

func (m *ManagedRuntime) GatewayQueries() *GatewayQueries {
	adapter := m.RuntimeAdapter()
	if adapter == nil {
		return nil
	}
	return adapter.GatewayQueries()
}

func (m *ManagedRuntime) SessionQueries() *SessionQueries {
	adapter := m.RuntimeAdapter()
	if adapter == nil {
		return nil
	}
	return adapter.SessionQueries()
}

func (m *ManagedRuntime) SessionCommands() *SessionCommands {
	adapter := m.RuntimeAdapter()
	if adapter == nil {
		return nil
	}
	return adapter.SessionCommands()
}

func (m *ManagedRuntime) SessionSubscriptions() *SessionSubscriptions {
	adapter := m.RuntimeAdapter()
	if adapter == nil {
		return nil
	}
	return adapter.SessionSubscriptions()
}

func (m *ManagedRuntime) GetGatewayDescribe(ctx context.Context, runtimeID string, includeSchemas bool) (any, error) {
	return m.GatewayQueries().Describe(ctx, includeSchemas)
}

func (m *ManagedRuntime) GetGatewayHealth(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().Health(ctx)
}

func (m *ManagedRuntime) GetGatewayStatus(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().Status(ctx)
}

func (m *ManagedRuntime) RequestGateway(ctx context.Context, runtimeID string, method string, params any) (any, error) {
	if m != nil && m.bffViews != nil {
		payload, handled, err := m.bffViews.Dispatch(ctx, method, params)
		if handled {
			return payload, err
		}
	}
	return m.GatewayQueries().RequestTypedRaw(ctx, method, params)
}

func (m *ManagedRuntime) GatewayBatch(ctx context.Context, runtimeID string, params generated.GatewayBatchParams) (generated.GatewayBatchResult, error) {
	return m.GatewayQueries().Batch(ctx, params)
}

func (m *ManagedRuntime) BridgeGatewayFrame(ctx context.Context, runtimeID string, raw []byte, idPrefix string) ([]byte, error) {
	return m.GatewayQueries().BridgeFrame(ctx, raw, idPrefix)
}

func (m *ManagedRuntime) LoadGatewayStatus(ctx context.Context) (GatewayStatusSummary, error) {
	return m.GatewayStatus().Load(ctx)
}

func (m *ManagedRuntime) Describe(ctx context.Context, includeSchemas bool) (any, error) {
	return m.GatewayQueries().Describe(ctx, includeSchemas)
}

func (m *ManagedRuntime) Health(ctx context.Context) (any, error) {
	return m.GatewayQueries().Health(ctx)
}

func (m *ManagedRuntime) Status(ctx context.Context) (any, error) {
	return m.GatewayQueries().Status(ctx)
}

func (m *ManagedRuntime) ConfigSchemaLookup(ctx context.Context, path string) (any, error) {
	return m.GatewayQueries().ConfigSchemaLookup(ctx, path)
}

func (m *ManagedRuntime) ListDevices(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().DevicePairList(ctx)
}

func (m *ManagedRuntime) DevicePairList(ctx context.Context) (any, error) {
	return m.GatewayQueries().DevicePairList(ctx)
}

func (m *ManagedRuntime) CurrentDeviceID() (string, error) {
	adapter := m.RuntimeAdapter()
	if adapter == nil {
		return "", nil
	}
	return adapter.CurrentDeviceID()
}

func (m *ManagedRuntime) GetCurrentDeviceID(runtimeID string) (string, error) {
	return m.CurrentDeviceID()
}

func (m *ManagedRuntime) ApproveDeviceRequest(ctx context.Context, runtimeID string, requestID string) (any, error) {
	return m.GatewayQueries().DevicePairApprove(ctx, map[string]any{"requestId": requestID})
}

func (m *ManagedRuntime) DevicePairApprove(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().DevicePairApprove(ctx, body)
}

func (m *ManagedRuntime) RejectDeviceRequest(ctx context.Context, runtimeID string, requestID string) (any, error) {
	return m.GatewayQueries().DevicePairReject(ctx, map[string]any{"requestId": requestID})
}

func (m *ManagedRuntime) DevicePairReject(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().DevicePairReject(ctx, body)
}

func (m *ManagedRuntime) RemoveDevice(ctx context.Context, runtimeID string, deviceID string) (any, error) {
	return m.GatewayQueries().DevicePairRemove(ctx, map[string]any{"deviceId": deviceID})
}

func (m *ManagedRuntime) DevicePairRemove(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().DevicePairRemove(ctx, body)
}

func (m *ManagedRuntime) RotateDeviceToken(ctx context.Context, runtimeID string, deviceID string, role string) (any, error) {
	return m.DeviceTokenRotate(ctx, map[string]any{"deviceId": deviceID, "role": role})
}

func (m *ManagedRuntime) DeviceTokenRotate(ctx context.Context, body map[string]any) (any, error) {
	upstreamURL, oldToken, ok := m.gatewayConnection(ctx)
	payload, err := m.GatewayQueries().DeviceTokenRotate(ctx, body)
	if err != nil {
		return nil, err
	}
	if ok {
		transportBinding.InvalidateProbeClient(upstreamURL, oldToken)
	}
	return payload, nil
}

func (m *ManagedRuntime) RevokeDeviceToken(ctx context.Context, runtimeID string, deviceID string, role string) (any, error) {
	return m.GatewayQueries().DeviceTokenRevoke(ctx, map[string]any{"deviceId": deviceID, "role": role})
}

func (m *ManagedRuntime) DeviceTokenRevoke(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().DeviceTokenRevoke(ctx, body)
}

func (m *ManagedRuntime) GetConfig(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().ConfigGet(ctx)
}

func (m *ManagedRuntime) ConfigGet(ctx context.Context) (any, error) {
	return m.GatewayQueries().ConfigGet(ctx)
}

func (m *ManagedRuntime) PatchConfig(ctx context.Context, runtimeID string, patch map[string]any, baseHash string) (any, error) {
	raw, _ := json.Marshal(patch)
	return m.GatewayQueries().ConfigPatch(ctx, string(raw), baseHash, "")
}

func (m *ManagedRuntime) ConfigPatch(ctx context.Context, raw string, baseHash string, note string) (any, error) {
	return m.GatewayQueries().ConfigPatch(ctx, raw, baseHash, note)
}

func (m *ManagedRuntime) ApplyConfig(ctx context.Context, runtimeID string, raw string, baseHash string) (any, error) {
	return m.GatewayQueries().ConfigApply(ctx, raw, baseHash)
}

func (m *ManagedRuntime) ConfigApply(ctx context.Context, raw string, baseHash string) (any, error) {
	return m.GatewayQueries().ConfigApply(ctx, raw, baseHash)
}

func (m *ManagedRuntime) GetConfigSchema(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().ConfigSchema(ctx)
}

func (m *ManagedRuntime) LookupConfigSchema(ctx context.Context, runtimeID string, path string) (any, error) {
	return m.GatewayQueries().ConfigSchemaLookup(ctx, path)
}

func (m *ManagedRuntime) ConfigGetWithParams(ctx context.Context, params map[string]any) (any, error) {
	return m.GatewayQueries().ConfigGetWithParams(ctx, params)
}

func (m *ManagedRuntime) ListAgents(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().AgentsList(ctx)
}

func (m *ManagedRuntime) GetAgent(ctx context.Context, runtimeID string, agentID string) (any, bool, error) {
	result, err := m.GatewayQueries().AgentsList(ctx)
	if err != nil {
		return nil, false, err
	}
	for _, agent := range result.Agents {
		if agent.Id == agentID {
			return agent, true, nil
		}
	}
	return nil, false, nil
}

func (m *ManagedRuntime) GetAgentIdentity(ctx context.Context, runtimeID string, agentID string) (any, error) {
	return m.GatewayQueries().AgentIdentityGet(ctx, agentID)
}

func (m *ManagedRuntime) ListAgentFiles(ctx context.Context, runtimeID string, agentID string) (any, error) {
	return m.GatewayQueries().AgentFilesList(ctx, agentID)
}

func (m *ManagedRuntime) AgentFilesList(ctx context.Context, agentID string) (any, error) {
	return m.GatewayQueries().AgentFilesList(ctx, agentID)
}

func (m *ManagedRuntime) GetAgentFile(ctx context.Context, runtimeID string, agentID string, name string) (any, error) {
	return m.GatewayQueries().AgentFilesGet(ctx, agentID, name)
}

func (m *ManagedRuntime) CreateAgent(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	payload := map[string]any{}
	for key, value := range body {
		payload[key] = value
	}
	if strings.TrimSpace(runtimecoerce.String(payload["workspace"], "")) == "" {
		payload["workspace"] = m.defaultAgentWorkspace(ctx, runtimecoerce.String(payload["name"], ""))
	}
	return m.GatewayQueries().AgentsCreate(ctx, payload)
}

func (m *ManagedRuntime) AgentsList(ctx context.Context) (any, error) {
	return m.GatewayQueries().AgentsList(ctx)
}

func (m *ManagedRuntime) AgentsCreate(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().AgentsCreate(ctx, body)
}

func (m *ManagedRuntime) UpdateAgent(ctx context.Context, runtimeID string, agentID string, body map[string]any) (any, error) {
	payload := map[string]any{"agentId": agentID}
	for key, value := range body {
		payload[key] = value
	}
	return m.GatewayQueries().AgentsUpdate(ctx, payload)
}

func (m *ManagedRuntime) AgentsUpdate(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().AgentsUpdate(ctx, body)
}

func (m *ManagedRuntime) DeleteAgent(ctx context.Context, runtimeID string, agentID string) (any, error) {
	return m.GatewayQueries().AgentsDelete(ctx, agentID, false)
}

func (m *ManagedRuntime) AgentsDelete(ctx context.Context, agentID string) (any, error) {
	return m.GatewayQueries().AgentsDelete(ctx, agentID, false)
}

func (m *ManagedRuntime) SetAgentFile(ctx context.Context, runtimeID string, agentID string, name string, content string) (any, error) {
	return m.GatewayQueries().AgentFilesSet(ctx, agentID, name, content)
}

func (m *ManagedRuntime) AgentFilesSet(ctx context.Context, agentID string, name string, content string) (any, error) {
	return m.GatewayQueries().AgentFilesSet(ctx, agentID, name, content)
}

func (m *ManagedRuntime) AgentFilesGet(ctx context.Context, agentID string, name string) (any, error) {
	return m.GatewayQueries().AgentFilesGet(ctx, agentID, name)
}

func (m *ManagedRuntime) AgentIdentityGet(ctx context.Context, agentID string) (any, error) {
	return m.GatewayQueries().AgentIdentityGet(ctx, agentID)
}

func (m *ManagedRuntime) ListCommands(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().CommandsList(ctx)
}

func (m *ManagedRuntime) ToolsCatalog(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().ToolsCatalog(ctx, body)
}

func (m *ManagedRuntime) ToolsCatalogLegacy(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().ToolsCatalog(ctx, body)
}

func (m *ManagedRuntime) GetUsage(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().UsageStatus(ctx)
}

func (m *ManagedRuntime) UsageStatus(ctx context.Context) (any, error) {
	return m.GatewayQueries().UsageStatus(ctx)
}

func (m *ManagedRuntime) UsageCost(ctx context.Context, params map[string]any) (any, error) {
	return m.GatewayQueries().UsageCost(ctx, params)
}

func (m *ManagedRuntime) ListCronJobs(ctx context.Context, runtimeID string, params map[string]any) (any, error) {
	return m.GatewayQueries().CronList(ctx, params)
}

func (m *ManagedRuntime) AddCronJob(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().CronAdd(ctx, body)
}

func (m *ManagedRuntime) CronAdd(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().CronAdd(ctx, body)
}

func (m *ManagedRuntime) UpdateCronJob(ctx context.Context, runtimeID string, jobID string, patch map[string]any) (any, error) {
	return m.GatewayQueries().CronUpdate(ctx, jobID, patch)
}

func (m *ManagedRuntime) CronUpdate(ctx context.Context, jobID string, patch map[string]any) (any, error) {
	return m.GatewayQueries().CronUpdate(ctx, jobID, patch)
}

func (m *ManagedRuntime) RemoveCronJob(ctx context.Context, runtimeID string, jobID string) (any, error) {
	return m.GatewayQueries().CronRemove(ctx, jobID)
}

func (m *ManagedRuntime) CronRemove(ctx context.Context, jobID string) (any, error) {
	return m.GatewayQueries().CronRemove(ctx, jobID)
}

func (m *ManagedRuntime) RunCronJob(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().CronRun(ctx, body)
}

func (m *ManagedRuntime) CronRun(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().CronRun(ctx, body)
}

func (m *ManagedRuntime) ListCronRuns(ctx context.Context, runtimeID string, params map[string]any) (any, error) {
	return m.GatewayQueries().CronRuns(ctx, params)
}

func (m *ManagedRuntime) CronRuns(ctx context.Context, params map[string]any) (any, error) {
	return m.GatewayQueries().CronRuns(ctx, params)
}

func (m *ManagedRuntime) GetCronStatus(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().CronStatus(ctx)
}

func (m *ManagedRuntime) CronStatus(ctx context.Context) (any, error) {
	return m.GatewayQueries().CronStatus(ctx)
}

func (m *ManagedRuntime) DiscoverDeckCommands(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckCommandsDiscover(ctx, body)
}

func (m *ManagedRuntime) DeckCommandsDiscover(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckCommandsDiscover(ctx, body)
}

func (m *ManagedRuntime) GetDeckToolsEffective(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().ToolsEffective(ctx, body)
}

func (m *ManagedRuntime) ToolsEffective(ctx context.Context, body map[string]any) (any, error) {
	return m.GatewayQueries().ToolsEffective(ctx, body)
}

func (m *ManagedRuntime) ListDeckPlugins(ctx context.Context, runtimeID string, params map[string]any) (any, error) {
	return m.GatewayQueries().DeckPluginsList(ctx, params)
}

func (m *ManagedRuntime) GetDeckAgentDetail(ctx context.Context, runtimeID string, agentID string) (any, error) {
	return m.GatewayQueries().DeckAgentsDetail(ctx, agentID)
}

func (m *ManagedRuntime) RunDeckAgentAction(ctx context.Context, runtimeID string, action string, body map[string]any) (any, error) {
	switch action {
	case "health":
		return m.GatewayQueries().HealthWithParams(ctx, body)
	case "skills.get":
		return m.GatewayQueries().DeckAgentsSkillsGet(ctx, body)
	case "skills.set":
		return m.GatewayQueries().DeckAgentsSkillsSet(ctx, body)
	case "subagents.get":
		return m.GatewayQueries().DeckAgentsSubagentsGet(ctx, body)
	case "subagents.set":
		return m.GatewayQueries().DeckAgentsSubagentsSet(ctx, body)
	case "modelPolicy.get":
		return m.GatewayQueries().DeckAgentsModelPolicyGet(ctx, body)
	case "modelPolicy.set":
		return m.GatewayQueries().DeckAgentsModelPolicySet(ctx, body)
	case "toolPolicy.preview":
		return m.GatewayQueries().DeckAgentsToolPolicyPreview(ctx, body)
	case "systemPrompt.preview":
		return m.GatewayQueries().DeckAgentsSystemPromptPreview(ctx, body)
	case "eventStreams.get":
		return m.GatewayQueries().DeckAgentsEventStreamsGet(ctx, body)
	case "eventStreams.set":
		return m.GatewayQueries().DeckAgentsEventStreamsSet(ctx, body)
	case "impactPreview.get":
		return m.GatewayQueries().DeckAgentsImpactPreviewGet(ctx, body)
	case "config.patch":
		path := strings.TrimSpace(runtimecoerce.String(body["path"], ""))
		if path == "" || strings.Contains(path, "..") {
			return nil, http.ErrNotSupported
		}
		segments := strings.Split(path, ".")
		for _, segment := range segments {
			if segment == "" {
				return nil, http.ErrNotSupported
			}
		}
		patch := buildMergePatch(segments, body["value"])
		payload, err := m.GatewayQueries().ConfigGet(ctx)
		if err != nil {
			return nil, err
		}
		raw, _ := json.Marshal(patch)
		return m.GatewayQueries().ConfigPatch(ctx, string(raw), payload.Hash, "")
	default:
		return nil, http.ErrNotSupported
	}
}

func (m *ManagedRuntime) ListDeckIdentity(ctx context.Context, runtimeID string) (any, error) {
	return m.RequestGateway(ctx, runtimeID, "deck.identity.list", map[string]any{})
}

func (m *ManagedRuntime) LinkDeckIdentity(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckIdentityLink(ctx, body)
}

func (m *ManagedRuntime) UnlinkDeckIdentity(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckIdentityUnlink(ctx, body)
}

func (m *ManagedRuntime) ListDeckRouting(ctx context.Context, runtimeID string, params map[string]any) (any, error) {
	return m.RequestGateway(ctx, runtimeID, "deck.routing.list", params)
}

func (m *ManagedRuntime) AddDeckRouting(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckRoutingAdd(ctx, body)
}

func (m *ManagedRuntime) RemoveDeckRouting(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckRoutingRemove(ctx, body)
}

func (m *ManagedRuntime) ValidateDeckRouting(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckRoutingValidate(ctx, body)
}

func (m *ManagedRuntime) SimulateDeckRouting(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckRoutingSimulate(ctx, body)
}

func (m *ManagedRuntime) ListDeckSubagents(ctx context.Context, runtimeID string, params map[string]any) (any, error) {
	return m.RequestGateway(ctx, runtimeID, "deck.subagents.list", params)
}

func (m *ManagedRuntime) KillDeckSubagent(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckSubagentsKill(ctx, body)
}

func (m *ManagedRuntime) GetDeckSubagentLineage(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.RequestGateway(ctx, runtimeID, "deck.subagents.lineage", body)
}

func (m *ManagedRuntime) SteerDeckSubagent(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckSubagentsSteer(ctx, body)
}

func (m *ManagedRuntime) ListDeckThreads(ctx context.Context, runtimeID string, params map[string]any) (any, error) {
	return m.RequestGateway(ctx, runtimeID, "deck.threads.list", params)
}

func (m *ManagedRuntime) GetApprovals(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().ExecApprovalsGet(ctx)
}

func (m *ManagedRuntime) ResolveApproval(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().ExecApprovalResolve(ctx, body)
}

func (m *ManagedRuntime) ListPendingApprovals(ctx context.Context, runtimeID string) (any, error) {
	payload, err := m.GatewayQueries().ExecApprovalList(ctx)
	if err != nil {
		return nil, err
	}
	return normalizePendingApprovals(payload), nil
}

func (m *ManagedRuntime) SetApprovalPolicy(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().ExecApprovalsSet(ctx, body)
}

func (m *ManagedRuntime) ListPluginApprovals(ctx context.Context, runtimeID string) (any, error) {
	payload, err := m.GatewayQueries().PluginApprovalList(ctx)
	if err != nil {
		return nil, err
	}
	return normalizePluginApprovals(payload), nil
}

func (m *ManagedRuntime) ResolvePluginApproval(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().PluginApprovalResolve(ctx, body)
}

func (m *ManagedRuntime) GetMemoryHealth(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().DoctorMemoryStatus(ctx)
}

func (m *ManagedRuntime) DoctorMemoryStatus(ctx context.Context) (any, error) {
	return m.GatewayQueries().DoctorMemoryStatus(ctx)
}

func (m *ManagedRuntime) DoctorMemoryDreamDiary(ctx context.Context) (any, error) {
	return m.GatewayQueries().DoctorMemoryDreamDiary(ctx)
}

func (m *ManagedRuntime) DoctorMemoryBackfillDreamDiary(ctx context.Context) (any, error) {
	return m.GatewayQueries().DoctorMemoryBackfillDreamDiary(ctx)
}

func (m *ManagedRuntime) DoctorMemoryResetDreamDiary(ctx context.Context) (any, error) {
	return m.GatewayQueries().DoctorMemoryResetDreamDiary(ctx)
}

func (m *ManagedRuntime) DoctorMemoryResetGroundedShortTerm(ctx context.Context) (any, error) {
	return m.GatewayQueries().DoctorMemoryResetGroundedShortTerm(ctx)
}

func (m *ManagedRuntime) DoctorMemoryRepairDreamingArtifacts(ctx context.Context) (any, error) {
	return m.GatewayQueries().DoctorMemoryRepairDreamingArtifacts(ctx)
}

func (m *ManagedRuntime) DoctorMemoryDedupeDreamDiary(ctx context.Context) (any, error) {
	return m.GatewayQueries().DoctorMemoryDedupeDreamDiary(ctx)
}

func (m *ManagedRuntime) RunMemoryDreamAction(ctx context.Context, runtimeID string, action string) (any, error) {
	switch action {
	case "read":
		return m.GatewayQueries().DoctorMemoryDreamDiary(ctx)
	case "backfill":
		return m.GatewayQueries().DoctorMemoryBackfillDreamDiary(ctx)
	case "reset":
		return m.GatewayQueries().DoctorMemoryResetDreamDiary(ctx)
	case "resetShortTerm":
		return m.GatewayQueries().DoctorMemoryResetGroundedShortTerm(ctx)
	case "repair":
		return m.GatewayQueries().DoctorMemoryRepairDreamingArtifacts(ctx)
	case "dedupe":
		return m.GatewayQueries().DoctorMemoryDedupeDreamDiary(ctx)
	default:
		return nil, http.ErrNotSupported
	}
}

func (m *ManagedRuntime) ListNodes(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().NodeList(ctx)
}

func (m *ManagedRuntime) RunNodeAction(ctx context.Context, runtimeID string, action string, body map[string]any) (any, error) {
	switch action {
	case "describe":
		return m.GatewayQueries().NodeDescribe(ctx, body)
	case "rename":
		return m.GatewayQueries().NodeRename(ctx, body)
	case "invoke":
		return m.GatewayQueries().NodeInvoke(ctx, body)
	case "pending.enqueue":
		return m.GatewayQueries().NodePendingEnqueue(ctx, body)
	default:
		return nil, http.ErrNotSupported
	}
}

func (m *ManagedRuntime) ListNodePairing(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().NodePairList(ctx)
}

func (m *ManagedRuntime) RunNodePairAction(ctx context.Context, runtimeID string, action string, body map[string]any) (any, error) {
	switch action {
	case "request":
		return m.GatewayQueries().NodePairRequest(ctx, body)
	case "approve":
		return m.GatewayQueries().NodePairApprove(ctx, body)
	case "reject":
		return m.GatewayQueries().NodePairReject(ctx, body)
	case "verify":
		return m.GatewayQueries().NodePairVerify(ctx, body)
	default:
		return nil, http.ErrNotSupported
	}
}

func (m *ManagedRuntime) ListSkills(ctx context.Context, runtimeID string, params map[string]any) (any, error) {
	return m.GatewayQueries().SkillsStatus(ctx, params)
}

func (m *ManagedRuntime) UpdateSkill(ctx context.Context, runtimeID string, skillKey string, body map[string]any) (any, error) {
	if body == nil {
		body = map[string]any{}
	}
	body["skillKey"] = skillKey
	return m.GatewayQueries().SkillsUpdate(ctx, body)
}

func (m *ManagedRuntime) InstallSkill(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().SkillsInstall(ctx, body)
}

func (m *ManagedRuntime) RunSkillsHubAction(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	action, _ := body["action"].(string)
	switch action {
	case "search":
		delete(body, "action")
		return m.GatewayQueries().SkillsSearch(ctx, body)
	case "detail":
		delete(body, "action")
		return m.GatewayQueries().SkillsDetail(ctx, body)
	case "install":
		delete(body, "action")
		return m.GatewayQueries().SkillsInstall(ctx, body)
	case "update":
		delete(body, "action")
		return m.GatewayQueries().SkillsUpdate(ctx, body)
	case "bins":
		return m.GatewayQueries().SkillsBins(ctx)
	default:
		return nil, http.ErrNotSupported
	}
}

func (m *ManagedRuntime) UpdateClawhubSkill(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	if body == nil {
		body = map[string]any{}
	}
	body["source"] = "clawhub"
	return m.GatewayQueries().SkillsUpdate(ctx, body)
}

func (m *ManagedRuntime) ListModels(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().ModelsList(ctx)
}

func (m *ManagedRuntime) GetModelAuthOverview(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().DeckAuthOverview(ctx)
}

func (m *ManagedRuntime) ListModelCatalogProviders(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().ModelsCatalogProviders(ctx)
}

func (m *ManagedRuntime) ListConfiguredModels(ctx context.Context, runtimeID string) (any, error) {
	return m.GatewayQueries().ModelsConfigured(ctx)
}

func (m *ManagedRuntime) ProbeModelAuth(ctx context.Context, runtimeID string, body map[string]any) (any, error) {
	return m.GatewayQueries().DeckAuthProbe(ctx, body)
}

func (m *ManagedRuntime) GetChannels(ctx context.Context, runtimeID string, params map[string]any) (any, error) {
	return m.GatewayQueries().ChannelsStatus(ctx, params)
}

func (m *ManagedRuntime) LogoutChannel(ctx context.Context, runtimeID string, channelID string) (any, error) {
	return m.GatewayQueries().ChannelsLogout(ctx, channelID)
}

func (m *ManagedRuntime) TestChannel(ctx context.Context, runtimeID string, channelID string) (any, error) {
	startedAt := time.Now()
	payload, err := m.GatewayQueries().ChannelsStatus(ctx, map[string]any{"probe": true})
	if err != nil {
		return map[string]any{
			"ok":        false,
			"channelId": channelID,
			"check":     "probe",
			"error":     err.Error(),
			"latencyMs": time.Since(startedAt).Milliseconds(),
		}, nil
	}
	channelEntries := payload.ChannelAccounts[channelID]
	anyOK := false
	firstError := ""
	for _, account := range channelEntries {
		probe := runtimecoerce.Map(account.Probe)
		if ok, _ := probe["ok"].(bool); ok {
			anyOK = true
			break
		}
		if firstError == "" {
			firstError = runtimecoerce.String(probe["error"], "")
		}
	}
	latencyMs := time.Since(startedAt).Milliseconds()
	if anyOK {
		return map[string]any{
			"ok":        true,
			"channelId": channelID,
			"check":     "probe",
			"latencyMs": latencyMs,
			"checkedAt": time.Now().UnixMilli(),
		}, nil
	}
	if firstError == "" {
		firstError = "Channel " + channelID + " did not pass connectivity probe"
	}
	return map[string]any{
		"ok":        false,
		"channelId": channelID,
		"check":     "probe",
		"error":     firstError,
		"latencyMs": latencyMs,
	}, nil
}

func (m *ManagedRuntime) GetChannelThroughput(ctx context.Context, runtimeID string, channelID string) (any, error) {
	return map[string]any{
		"buckets":     []any{},
		"messagesIn":  0,
		"messagesOut": 0,
	}, nil
}

func (m *ManagedRuntime) PatchChannel(ctx context.Context, runtimeID string, channelID string, patch map[string]any) (any, error) {
	payload, err := m.GatewayQueries().ConfigGet(ctx)
	if err != nil {
		return nil, err
	}
	raw, _ := json.MarshalIndent(map[string]any{
		"channels": map[string]any{
			channelID: patch,
		},
	}, "", "  ")
	return m.GatewayQueries().ConfigPatch(ctx, string(raw), payload.Hash, "")
}

func (m *ManagedRuntime) ListSessionsWithParams(ctx context.Context, params map[string]any, agentID string) ([]deckapi.DeckGoSessionMeta, error) {
	return m.SessionQueries().ListSessionsWithParams(ctx, params, agentID)
}

func (m *ManagedRuntime) Delete(ctx context.Context, sessionKey string) (deckapi.DeckGoSessionMutationResponse, error) {
	return m.SessionCommands().Delete(ctx, sessionKey)
}

func (m *ManagedRuntime) Preview(ctx context.Context, keys []string) (deckapi.DeckGoSessionsPreviewResponse, error) {
	return m.SessionCommands().Preview(ctx, keys)
}

func (m *ManagedRuntime) Reset(ctx context.Context, sessionKey string, reason string) (deckapi.DeckGoSessionMutationResponse, error) {
	return m.SessionCommands().Reset(ctx, sessionKey, reason)
}

func (m *ManagedRuntime) Clear(ctx context.Context, sessionKey string) (deckapi.DeckGoSessionMutationResponse, error) {
	return m.SessionCommands().Clear(ctx, sessionKey)
}

func (m *ManagedRuntime) Patch(ctx context.Context, sessionKey string, patch map[string]any) (deckapi.DeckGoSessionMutationResponse, error) {
	return m.SessionCommands().Patch(ctx, sessionKey, patch)
}

func (m *ManagedRuntime) Create(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionCreateResponse, error) {
	return m.SessionCommands().Create(ctx, params)
}

func (m *ManagedRuntime) Send(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionSendResponse, error) {
	return m.SessionCommands().Send(ctx, params)
}

func (m *ManagedRuntime) Abort(ctx context.Context, params map[string]any) (deckapi.DeckGoSessionAbortResponse, error) {
	return m.SessionCommands().Abort(ctx, params)
}

func (m *ManagedRuntime) Compact(ctx context.Context, sessionKey string) (any, error) {
	return m.SessionCommands().Compact(ctx, sessionKey)
}

func (m *ManagedRuntime) CompactionList(ctx context.Context, sessionKey string) (any, error) {
	return m.SessionCommands().CompactionList(ctx, sessionKey)
}

func (m *ManagedRuntime) CompactionBranch(ctx context.Context, sessionKey string, checkpointID string) (any, error) {
	return m.SessionCommands().CompactionBranch(ctx, sessionKey, checkpointID)
}

func (m *ManagedRuntime) CompactionRestore(ctx context.Context, sessionKey string, checkpointID string) (any, error) {
	return m.SessionCommands().CompactionRestore(ctx, sessionKey, checkpointID)
}

func (m *ManagedRuntime) Steer(ctx context.Context, sessionKey string, message string) (any, error) {
	return m.SessionCommands().Steer(ctx, sessionKey, message)
}

func (m *ManagedRuntime) RunCompactionAction(ctx context.Context, body map[string]any) (any, int, error) {
	key := strings.TrimSpace(runtimecoerce.String(body["key"], ""))
	if key == "" {
		return map[string]any{"error": "key is required"}, http.StatusBadRequest, nil
	}
	action := runtimecoerce.String(body["action"], "")
	switch action {
	case "list":
		payload, err := m.CompactionList(ctx, key)
		return payload, http.StatusOK, err
	case "branch":
		checkpointID := strings.TrimSpace(runtimecoerce.String(body["checkpointId"], ""))
		if checkpointID == "" {
			return map[string]any{"error": "checkpointId is required"}, http.StatusBadRequest, nil
		}
		payload, err := m.CompactionBranch(ctx, key, checkpointID)
		return payload, http.StatusOK, err
	case "restore":
		checkpointID := strings.TrimSpace(runtimecoerce.String(body["checkpointId"], ""))
		if checkpointID == "" {
			return map[string]any{"error": "checkpointId is required"}, http.StatusBadRequest, nil
		}
		payload, err := m.CompactionRestore(ctx, key, checkpointID)
		return payload, http.StatusOK, err
	default:
		return map[string]any{"error": `unknown action "` + action + `"`}, http.StatusBadRequest, nil
	}
}

func (m *ManagedRuntime) SteerSession(ctx context.Context, sessionKey string, message string) (any, int, error) {
	if strings.TrimSpace(sessionKey) == "" || strings.TrimSpace(message) == "" {
		return map[string]any{"error": "sessionKey and message are required"}, http.StatusBadRequest, nil
	}
	payload, err := m.Steer(ctx, sessionKey, message)
	return payload, http.StatusOK, err
}

func (m *ManagedRuntime) CreateSession(ctx context.Context, runtimeID string, agentID string, message string, model string, label string, parentSessionKey string) (deckapi.DeckGoSessionCreateResponse, error) {
	params := map[string]any{}
	if agentID != "" {
		params["agentId"] = agentID
	}
	if message != "" {
		params["message"] = message
	}
	if model != "" {
		params["model"] = model
	}
	if label != "" {
		params["label"] = label
	}
	if parentSessionKey != "" {
		params["parentSessionKey"] = parentSessionKey
	}
	return m.SessionCommands().Create(ctx, params)
}

func (m *ManagedRuntime) SendMessage(ctx context.Context, runtimeID string, sessionID string, text string, attachments []map[string]any, idempotencyKey string) error {
	_, err := m.SessionCommands().Send(ctx, map[string]any{
		"key":     sessionID,
		"message": text,
		"attachments": func() any {
			if len(attachments) == 0 {
				return nil
			}
			return attachments
		}(),
		"idempotencyKey": func() any {
			if idempotencyKey == "" {
				return nil
			}
			return idempotencyKey
		}(),
	})
	return err
}

func (m *ManagedRuntime) AbortRun(ctx context.Context, runtimeID string, runID string, idempotencyKey string) error {
	run, _, ok, err := m.GetRun(ctx, runtimeID, runID)
	if err != nil {
		return err
	}
	if !ok {
		return http.ErrMissingFile
	}
	_, err = m.SessionCommands().Abort(ctx, map[string]any{
		"key":   run.SessionKey,
		"runId": runID,
	})
	return err
}

func (m *ManagedRuntime) CompactSession(ctx context.Context, runtimeID string, sessionID string, idempotencyKey string) error {
	_, err := m.SessionCommands().Compact(ctx, sessionID)
	return err
}

func (m *ManagedRuntime) DeleteSession(ctx context.Context, runtimeID string, sessionID string, idempotencyKey string) error {
	_, err := m.SessionCommands().Delete(ctx, sessionID)
	return err
}

func (m *ManagedRuntime) ResetSession(ctx context.Context, runtimeID string, sessionID string, reason string, idempotencyKey string) error {
	_, err := m.SessionCommands().Reset(ctx, sessionID, reason)
	return err
}

func (m *ManagedRuntime) ClearSession(ctx context.Context, runtimeID string, sessionID string, idempotencyKey string) error {
	_, err := m.SessionCommands().Clear(ctx, sessionID)
	return err
}

func (m *ManagedRuntime) PatchSession(ctx context.Context, runtimeID string, sessionID string, patch map[string]any, idempotencyKey string) error {
	if patch == nil {
		patch = map[string]any{}
	}
	patch["key"] = sessionID
	_, err := m.SessionCommands().Patch(ctx, sessionID, patch)
	return err
}

func (m *ManagedRuntime) ChatHistory(ctx context.Context, params map[string]any) (any, error) {
	return m.GatewayQueries().ChatHistory(ctx, params)
}

func (m *ManagedRuntime) GetTimelineWithParams(ctx context.Context, sessionKey string, agentID string, limit int) (deckapi.DeckGoSessionDetailResponse, error) {
	return m.SessionQueries().GetTimelineWithParams(ctx, sessionKey, agentID, limit)
}

func (m *ManagedRuntime) LogsTail(ctx context.Context, params map[string]any) (any, error) {
	return m.GatewayQueries().LogsTail(ctx, params)
}

func (m *ManagedRuntime) TailLogs(ctx context.Context, params map[string]any) (any, error) {
	return m.LogsTail(ctx, params)
}

func (m *ManagedRuntime) SubscribeSession(ctx context.Context, sessionKey string) error {
	return m.SessionSubscriptions().SubscribeSession(ctx, sessionKey)
}

func (m *ManagedRuntime) UnsubscribeSession(ctx context.Context, sessionKey string) error {
	return m.SessionSubscriptions().UnsubscribeSession(ctx, sessionKey)
}

func (m *ManagedRuntime) GetUsageCost(ctx context.Context, days int) (any, error) {
	return m.UsageCost(ctx, map[string]any{"days": days})
}

func (m *ManagedRuntime) GetUsageProviders(ctx context.Context) (any, error) {
	return m.UsageStatus(ctx)
}

func (m *ManagedRuntime) GetUsageSessions(ctx context.Context, params map[string]any) (any, error) {
	return m.GatewayQueries().SessionsUsage(ctx, params)
}

func (m *ManagedRuntime) GetUsageSessionLogs(ctx context.Context, params map[string]any) (any, error) {
	return m.GatewayQueries().SessionsUsageLogs(ctx, params)
}

func (m *ManagedRuntime) GetUsageTimeseries(ctx context.Context, params map[string]any) (any, error) {
	return m.GatewayQueries().SessionsUsageTimeseries(ctx, params)
}

func (m *ManagedRuntime) GetModelsConfig(ctx context.Context) (any, error) {
	return m.ConfigGet(ctx)
}

func (m *ManagedRuntime) PatchModelsConfig(ctx context.Context, raw string, baseHash string, note string) (any, error) {
	return m.ConfigPatch(ctx, raw, baseHash, note)
}

func (m *ManagedRuntime) GetModelUsageProviders(ctx context.Context) (any, error) {
	return m.UsageStatus(ctx)
}

func (m *ManagedRuntime) GetModelUsageCost(ctx context.Context, days int) (any, error) {
	return m.UsageCost(ctx, map[string]any{"days": days})
}

func (m *ManagedRuntime) gatewayConnection(ctx context.Context) (string, string, bool) {
	if m != nil && m.facade != nil {
		conn, err := m.facade.GatewayConnection(ctx)
		if err == nil && strings.TrimSpace(conn.URL) != "" {
			return conn.URL, conn.Token, true
		}
	}
	return "", "", false
}

func (m *ManagedRuntime) RuntimeRegistry() *runtimeregistry.Registry {
	if m == nil {
		return nil
	}
	return m.registry
}

func (m *ManagedRuntime) ListRuntimes(ctx context.Context) ([]runtimeregistry.RuntimeSummary, error) {
	registry := m.RuntimeRegistry()
	if registry == nil {
		return nil, nil
	}
	return registry.ListRuntimes(ctx)
}

func (m *ManagedRuntime) GetRuntime(ctx context.Context, runtimeID string) (runtimeregistry.RuntimeSummary, bool, error) {
	registry := m.RuntimeRegistry()
	if registry == nil {
		return runtimeregistry.RuntimeSummary{}, false, nil
	}
	return registry.GetRuntime(ctx, runtimeID)
}

func (m *ManagedRuntime) Replay(lastID int64) ([]events.Event, bool) {
	registry := m.RuntimeRegistry()
	if registry == nil {
		return nil, false
	}
	return registry.Replay(lastID)
}

func (m *ManagedRuntime) EventsSince(lastID int64) ([]events.Event, bool) {
	return m.Replay(lastID)
}

func (m *ManagedRuntime) SupportsRuntime(runtimeID string) bool {
	registry := m.RuntimeRegistry()
	return registry != nil && registry.SupportsRuntime(runtimeID)
}

func (m *ManagedRuntime) Subscribe(ctx context.Context) <-chan events.Event {
	registry := m.RuntimeRegistry()
	if registry == nil {
		ch := make(chan events.Event)
		close(ch)
		return ch
	}
	return registry.Subscribe(ctx)
}

func (m *ManagedRuntime) SubscribeStream() (<-chan events.Event, func()) {
	ctx, cancel := context.WithCancel(context.Background())
	return m.Subscribe(ctx), cancel
}

func (m *ManagedRuntime) ListActivity(ctx context.Context, runtimeID string, limit int) ([]runtimeprojection.ActivityEventEntry, error) {
	if m == nil || m.monitor == nil {
		return nil, nil
	}
	return m.monitor.ListActivity(ctx, runtimeID, limit)
}

func (m *ManagedRuntime) ListRuns(ctx context.Context, runtimeID string) ([]runtimeprojection.RunRecord, error) {
	if m == nil || m.monitor == nil {
		return nil, nil
	}
	return m.monitor.ListRuns(ctx, runtimeID)
}

func (m *ManagedRuntime) GetRun(ctx context.Context, runtimeID string, runID string) (runtimeprojection.RunRecord, []runtimeprojection.RunEventRow, bool, error) {
	if m == nil || m.monitor == nil {
		return runtimeprojection.RunRecord{}, nil, false, nil
	}
	return m.monitor.GetRun(ctx, runtimeID, runID)
}

func (m *ManagedRuntime) GetStats(ctx context.Context, runtimeID string) (runtimeprojection.MonitorStats, error) {
	if m == nil || m.monitor == nil {
		return runtimeprojection.MonitorStats{}, nil
	}
	return m.monitor.GetStats(ctx, runtimeID)
}

func (m *ManagedRuntime) EventBus() *events.Bus {
	if m == nil {
		return nil
	}
	return m.bus
}

func (m *ManagedRuntime) defaultAgentWorkspace(ctx context.Context, name string) string {
	if strings.TrimSpace(name) == "" {
		return ""
	}
	if payload, err := m.GatewayQueries().ConfigGetWithParams(ctx, map[string]any{"path": "agents.defaults.workspace"}); err == nil {
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

func buildMergePatch(path []string, value any) map[string]any {
	root := map[string]any{}
	current := root
	for i := 0; i < len(path)-1; i++ {
		next := map[string]any{}
		current[path[i]] = next
		current = next
	}
	current[path[len(path)-1]] = value
	return root
}
