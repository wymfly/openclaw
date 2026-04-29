package openclaw

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
	runtimeregistry "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/registry"
)

type recordingManagedSupervisor struct {
	snapshot         runtimecontrol.Snapshot
	startCalls       int
	stopCalls        int
	restartCalls     int
	ensureAutoStarts int
	gatewayToken     string
}

func (s *recordingManagedSupervisor) Snapshot() runtimecontrol.Snapshot {
	return s.snapshot
}

func (s *recordingManagedSupervisor) Start(context.Context) (runtimecontrol.Snapshot, error) {
	s.startCalls++
	s.snapshot.Status = runtimecontrol.StatusRunning
	s.snapshot.Health = runtimecontrol.HealthHealthy
	if s.snapshot.GatewayURL == "" {
		s.snapshot.GatewayURL = "ws://127.0.0.1:18789"
	}
	if s.gatewayToken == "" {
		s.gatewayToken = "gateway-token"
	}
	return s.snapshot, nil
}

func (s *recordingManagedSupervisor) Stop(context.Context) (runtimecontrol.Snapshot, error) {
	s.stopCalls++
	s.snapshot.Status = runtimecontrol.StatusStopped
	s.snapshot.Health = runtimecontrol.HealthUnknown
	return s.snapshot, nil
}

func (s *recordingManagedSupervisor) Restart(context.Context) (runtimecontrol.Snapshot, error) {
	s.restartCalls++
	s.snapshot.Status = runtimecontrol.StatusRunning
	s.snapshot.Health = runtimecontrol.HealthHealthy
	if s.snapshot.GatewayURL == "" {
		s.snapshot.GatewayURL = "ws://127.0.0.1:18789"
	}
	if s.gatewayToken == "" {
		s.gatewayToken = "gateway-token"
	}
	return s.snapshot, nil
}

func (s *recordingManagedSupervisor) GatewayConnection() (string, string, bool) {
	if s.snapshot.GatewayURL == "" || s.gatewayToken == "" {
		return "", "", false
	}
	return s.snapshot.GatewayURL, s.gatewayToken, true
}

func (s *recordingManagedSupervisor) EnsureAutoStart() {
	s.ensureAutoStarts++
}

func TestNewManagedRuntime_ComposesSupervisorAdapterAndRegistry(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	bus := events.NewBus(8)

	managed := NewManagedRuntime(store, bus)
	t.Cleanup(func() { _ = managed.Close() })
	if managed == nil {
		t.Fatal("expected managed runtime bundle")
	}
	if managed.supervisor == nil {
		t.Fatal("expected supervisor in managed runtime bundle")
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
	if _, _, ok := managed.GatewayConnection(); ok {
		t.Fatal("expected unmanaged test supervisor to report disconnected gateway")
	}
}

func TestManagedRuntime_PropagatesLifecycleStateIntoRegistrySummaries(t *testing.T) {
	t.Setenv("DECK_GO_DATA_DIR", t.TempDir())

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(config.Settings{
		ManagedGateway: config.ManagedGatewaySettings{
			Command:      "openclaw",
			GatewayToken: "token",
		},
	}); err != nil {
		t.Fatal(err)
	}

	bus := events.NewBus(8)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	supervisor := NewManagedSupervisorWithOptions(
		store,
		bus,
		WithManagedLauncher(func(config.ManagedGatewaySettings) (*exec.Cmd, error) {
			return nil, errors.New("launch failed")
		}),
	)
	managed := NewManagedRuntimeWithStoreAndSupervisor(store, supervisor, bus)
	t.Cleanup(func() { _ = managed.Close() })

	if _, err := managed.Start(context.Background()); err == nil {
		t.Fatal("expected managed runtime start failure")
	}

	expectManagedRuntimeEvent(t, sub, "runtime.gateway.status")

	snapshot := managed.Snapshot()
	if snapshot.Status != runtimecontrol.StatusFailed {
		t.Fatalf("expected failed lifecycle snapshot, got %#v", snapshot)
	}

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
	if items[0].Status != string(runtimecontrol.StatusFailed) {
		t.Fatalf("expected failed runtime summary, got %#v", items[0])
	}
	if items[0].LastError == nil || *items[0].LastError != "launch failed" {
		t.Fatalf("expected launch failure to surface in registry summary, got %#v", items[0])
	}
}

func expectManagedRuntimeEvent(t *testing.T, sub <-chan events.Event, eventType string) {
	t.Helper()
	select {
	case event := <-sub:
		if event.Type != eventType {
			t.Fatalf("expected event %s, got %#v", eventType, event)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for %s", eventType)
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
		"EnsureAutoStart":                     {},
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
