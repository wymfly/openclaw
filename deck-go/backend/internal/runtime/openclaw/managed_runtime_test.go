package openclaw

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade/testfacade"
	runtimeregistry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
)

func TestNewManagedRuntimeWithFacade_ComposesAdapterAndRegistry(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)
	runtimeFacade := testfacade.New(facade.Capabilities{Mode: "local", Configured: true})

	managed := NewManagedRuntimeWithFacade(store, runtimeFacade, bus)
	t.Cleanup(func() { _ = managed.Close() })
	if managed == nil {
		t.Fatal("expected managed runtime bundle")
	}
	if managed.Facade() != runtimeFacade {
		t.Fatal("expected facade in managed runtime bundle")
	}
	if managed.RuntimeAdapter() == nil {
		t.Fatal("expected adapter in managed runtime bundle")
	}
	if managed.RuntimeRegistry() == nil {
		t.Fatal("expected registry in managed runtime bundle")
	}
	if managed.EventBus() != bus {
		t.Fatal("expected event bus in managed runtime bundle")
	}
	if managed.GatewayQueries() == nil {
		t.Fatal("expected managed runtime facade to expose gateway queries directly")
	}
	if managed.SessionCommands() == nil {
		t.Fatal("expected managed runtime facade to expose session commands directly")
	}
	if _, err := managed.ListRuns(t.Context(), "rt_local"); err != nil {
		t.Fatalf("expected managed runtime facade to expose monitor queries: %v", err)
	}
	if _, err := managed.GetStats(t.Context(), "rt_local"); err != nil {
		t.Fatalf("expected managed runtime facade to expose monitor stats: %v", err)
	}

	items, err := managed.ListRuntimes(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("unexpected runtime registry contents: %#v", items)
	}
}

func TestNewManagedRuntimeWithFacadeRoutesGatewayCallsThroughInjectedRequester(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	requester := &stubAdapterRequester{
		t: t,
		payload: map[string]any{
			"sessions.create": map[string]any{
				"key":        "session-remote",
				"sessionId":  "session-remote",
				"runId":      "run-remote",
				"status":     "started",
				"runStarted": true,
			},
		},
		errs: map[string]error{},
	}
	runtimeFacade := facadeRequester{
		Stub:      testfacade.New(facade.Capabilities{Mode: "remote", Configured: true}),
		requester: requester,
	}

	managed := NewManagedRuntimeWithFacade(store, runtimeFacade, events.NewBus(8))
	created, err := managed.Create(context.Background(), map[string]any{"message": "hello"})
	if err != nil {
		t.Fatal(err)
	}
	if created.Key != "session-remote" || created.RunId != "run-remote" {
		t.Fatalf("unexpected session create response: %#v", created)
	}
}

type facadeRequester struct {
	*testfacade.Stub
	requester *stubAdapterRequester
}

func (f facadeRequester) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	return f.requester.Request(ctx, method, params)
}

func (f facadeRequester) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	return f.requester.RequestTyped(ctx, method, params)
}

func TestManagedRuntime_PropagatesCachedLifecycleStateIntoRegistrySummaries(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}

	bus := events.NewBus(8)
	managed := NewManagedRuntimeWithFacade(
		store,
		testfacade.New(facade.Capabilities{Mode: "local", Configured: true}),
		bus,
	)
	t.Cleanup(func() { _ = managed.Close() })
	lastError := "launch failed"
	managed.RecordRuntimeStatus(facade.RuntimeStatus{
		Mode:       "local",
		Configured: true,
		Status:     "failed",
		Health:     "unhealthy",
		LastError:  &lastError,
	})

	items, err := managed.ListRuntimes(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one runtime summary, got %#v", items)
	}
	if items[0].RuntimeID != runtimeregistry.DefaultRuntimeID {
		t.Fatalf("expected default runtime id, got %#v", items[0])
	}
	if items[0].Status != "failed" {
		t.Fatalf("expected failed runtime summary, got %#v", items[0])
	}
	if items[0].LastError == nil || *items[0].LastError != "launch failed" {
		t.Fatalf("expected launch failure to surface in registry summary, got %#v", items[0])
	}
}

func TestManagedRuntime_UpdateSettingsDoesNotCarryForwardRuntimeTokens(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		AccessToken: "old-token",
		ManagedGateway: config.ManagedGatewaySettings{
			GatewayToken: "old-token",
		},
	}); err != nil {
		t.Fatal(err)
	}
	managed := NewManagedRuntimeWithFacade(
		store,
		testfacade.New(facade.Capabilities{Mode: "local", Configured: true}),
		events.NewBus(4),
	)
	t.Cleanup(func() { _ = managed.Close() })

	_, err = managed.UpdateSettings(context.Background(), deckapi.DeckGoSettings{
		Appearance: map[string]any{"theme": "dark"},
	})
	if err != nil {
		t.Fatalf("UpdateSettings() error = %v", err)
	}
	current := store.Get()
	if current.AccessToken != "" || current.ManagedGateway.GatewayToken != "" {
		t.Fatalf("runtime tokens were carried forward: %#v", current)
	}
}

func TestExternalPackages_DoNotCallRawManagedRuntimeSupervisorMethods(t *testing.T) {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve current test file")
	}

	root := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", ".."))
	targetDirs := []string{
		filepath.Join(root, "server"),
		filepath.Join(root, "controld"),
	}
	forbiddenPatterns := []string{
		"managed.Start(",
		"managed.Stop(",
		"managed.Restart(",
		"managed.Snapshot(",
		"managed.GatewayConnection(",
		"managed.RuntimeSupervisor(",
		"deps.Runtime.Start(",
		"deps.Runtime.Stop(",
		"deps.Runtime.Restart(",
		"deps.Runtime.Snapshot(",
		"deps.Runtime.GatewayConnection(",
		"deps.Runtime.RuntimeSupervisor(",
	}

	for _, dir := range targetDirs {
		files, err := filepath.Glob(filepath.Join(dir, "*.go"))
		if err != nil {
			t.Fatalf("failed to glob %s: %v", dir, err)
		}
		for _, file := range files {
			if strings.HasSuffix(file, "_test.go") {
				continue
			}
			content, err := os.ReadFile(file)
			if err != nil {
				t.Fatalf("failed to read %s: %v", file, err)
			}
			source := string(content)
			for _, pattern := range forbiddenPatterns {
				if strings.Contains(source, pattern) {
					t.Fatalf("unexpected raw ManagedRuntimeSurface supervisor dependency %q in %s", pattern, file)
				}
			}
		}
	}
}

func TestExternalPackages_UseOnlyDedicatedManagedRuntimeSurfaceMethods(t *testing.T) {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve current test file")
	}

	root := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", ".."))
	targetDirs := []string{
		filepath.Join(root, "server"),
		filepath.Join(root, "controld"),
	}
	allowedMethods := map[string]struct{}{
		"Abort":                               {},
		"AgentFilesList":                      {},
		"BootstrapStatus":                     {},
		"ChatHistory":                         {},
		"Clear":                               {},
		"Compact":                             {},
		"CompactionBranch":                    {},
		"CompactionList":                      {},
		"CompactionRestore":                   {},
		"ConfigApply":                         {},
		"ConfigGet":                           {},
		"ConfigPatch":                         {},
		"ConfigSchemaLookup":                  {},
		"Create":                              {},
		"Delete":                              {},
		"Describe":                            {},
		"DoctorMemoryBackfillDreamDiary":      {},
		"DoctorMemoryDedupeDreamDiary":        {},
		"DoctorMemoryDreamDiary":              {},
		"DoctorMemoryRepairDreamingArtifacts": {},
		"DoctorMemoryResetDreamDiary":         {},
		"DoctorMemoryResetGroundedShortTerm":  {},
		"DoctorMemoryStatus":                  {},
		"EventBus":                            {},
		"EventsSince":                         {},
		"GatewayQueries":                      {},
		"GetOnboardingStatus":                 {},
		"GetSettings":                         {},
		"GetTimelineWithParams":               {},
		"GetVersion":                          {},
		"Health":                              {},
		"ListSessionsWithParams":              {},
		"LogsTail":                            {},
		"Patch":                               {},
		"Preview":                             {},
		"Reset":                               {},
		"RuntimeGatewayStatusResponse":        {},
		"RuntimeRegistry":                     {},
		"SessionCommands":                     {},
		"SessionQueries":                      {},
		"SessionSubscriptions":                {},
		"Send":                                {},
		"SaveOnboardingSettings":              {},
		"StartRuntimeGateway":                 {},
		"Steer":                               {},
		"Status":                              {},
		"StopRuntimeGateway":                  {},
		"SubscribeSession":                    {},
		"SubscribeStream":                     {},
		"TestLegacySettingsConnection":        {},
		"TestOnboardingConnection":            {},
		"UnsubscribeSession":                  {},
		"UpdateSettingsFromConfig":            {},
	}
	pattern := regexp.MustCompile(`managed\.([A-Za-z_][A-Za-z0-9_]*)\(|deps\.Runtime\.([A-Za-z_][A-Za-z0-9_]*)\(`)

	for _, dir := range targetDirs {
		files, err := filepath.Glob(filepath.Join(dir, "*.go"))
		if err != nil {
			t.Fatalf("failed to glob %s: %v", dir, err)
		}
		for _, file := range files {
			if strings.HasSuffix(file, "_test.go") {
				continue
			}
			content, err := os.ReadFile(file)
			if err != nil {
				t.Fatalf("failed to read %s: %v", file, err)
			}
			matches := pattern.FindAllStringSubmatch(string(content), -1)
			var methods []string
			for _, match := range matches {
				method := match[1]
				if method == "" {
					method = match[2]
				}
				if method == "" {
					continue
				}
				methods = append(methods, method)
				if _, ok := allowedMethods[method]; !ok {
					t.Fatalf("unexpected ManagedRuntimeSurface dependency %q in %s", method, file)
				}
			}
			if len(methods) == 0 {
				continue
			}
			sort.Strings(methods)
			t.Logf("%s uses ManagedRuntimeSurface methods: %s", file, strings.Join(methods, ", "))
		}
	}
}
