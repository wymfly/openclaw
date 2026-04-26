package runtimecontrol

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	runtimetransport "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/transport"
)

type Status string

const (
	StatusStopped  Status = "stopped"
	StatusStarting Status = "starting"
	StatusRunning  Status = "running"
	StatusDegraded Status = "degraded"
	StatusStopping Status = "stopping"
	StatusFailed   Status = "failed"
)

type Health string

const (
	HealthUnknown   Health = "unknown"
	HealthHealthy   Health = "healthy"
	HealthUnhealthy Health = "unhealthy"
)

type Snapshot struct {
	Managed      bool   `json:"managed"`
	Configured   bool   `json:"configured,omitempty"`
	Status       Status `json:"status,omitempty"`
	FailurePhase string `json:"failurePhase,omitempty"`
	PID          int    `json:"pid,omitempty"`
	StartedAt    string `json:"startedAt,omitempty"`
	LastExitAt   string `json:"lastExitAt,omitempty"`
	LastExitCode int    `json:"lastExitCode,omitempty"`
	Health       Health `json:"health,omitempty"`
	GatewayURL   string `json:"gatewayUrl,omitempty"`
	LastError    string `json:"lastError,omitempty"`
	AutoStart    bool   `json:"autoStart,omitempty"`
}

type launcher func(config.ManagedGatewaySettings) (*exec.Cmd, error)
type probeFunc func(context.Context, config.ManagedGatewaySettings) error
type Option func(*Supervisor)
type LifecycleNotifier interface {
	PublishStatus(Snapshot)
	PublishHealth(Snapshot)
	PublishExit(Snapshot)
}
type ProbeTransitionContext struct {
	Err            error
	HealthyOnce    bool
	StartedAt      time.Time
	StartupTimeout time.Duration
	Now            time.Time
}
type ProbeTransitionDecision struct {
	Status       Status
	Health       Health
	LastError    string
	FailurePhase string
	HealthyOnce  bool
}
type ProbeTransitionPolicy func(ProbeTransitionContext) ProbeTransitionDecision
type StartFailureContext struct {
	Stage string
	Err   error
}
type StartFailureDecision struct {
	Status       Status
	Health       Health
	LastError    string
	FailurePhase string
}
type StartFailurePolicy func(StartFailureContext) StartFailureDecision
type StopSignalFailureContext struct {
	Err error
}
type StopSignalFailureDecision struct {
	Status       Status
	Health       Health
	LastError    string
	FailurePhase string
}
type StopSignalFailurePolicy func(StopSignalFailureContext) StopSignalFailureDecision
type StopNoProcessContext struct {
	HasCommand bool
	HasProcess bool
}
type StopNoProcessDecision struct {
	Status            Status
	Health            Health
	LastError         string
	FailurePhase      string
	ClearActiveConfig bool
}
type StopNoProcessPolicy func(StopNoProcessContext) StopNoProcessDecision
type StopWaitFailureContext struct {
	Stage    string
	TimedOut bool
	Err      error
}
type StopWaitFailureDecision struct {
	Status       Status
	Health       Health
	LastError    string
	FailurePhase string
}
type StopWaitFailurePolicy func(StopWaitFailureContext) StopWaitFailureDecision
type ExitTransitionContext struct {
	StopRequested bool
	StopTimedOut  bool
	Err           error
	ExitCode      int
}
type ExitTransitionDecision struct {
	Status            Status
	Health            Health
	LastError         string
	FailurePhase      string
	ClearActiveConfig bool
}
type ExitTransitionPolicy func(ExitTransitionContext) ExitTransitionDecision
type processTerminator func(*exec.Cmd) error

type Supervisor struct {
	store *config.Store

	notifier           LifecycleNotifier
	launch             launcher
	prepare            preflightFunc
	probe              probeFunc
	terminate          processTerminator
	forceKill          processTerminator
	probePolicy        ProbeTransitionPolicy
	startFailPolicy    StartFailurePolicy
	stopFailPolicy     StopSignalFailurePolicy
	stopNoProcPolicy   StopNoProcessPolicy
	stopWaitFailPolicy StopWaitFailurePolicy
	exitPolicy         ExitTransitionPolicy
	probeInterval      time.Duration
	stopTimeout        time.Duration
	startupTimeout     time.Duration

	mu            sync.RWMutex
	cmd           *exec.Cmd
	waitDone      chan struct{}
	activeConfig  config.ManagedGatewaySettings
	status        Status
	health        Health
	lastError     string
	failurePhase  string
	startedAt     time.Time
	lastExitAt    time.Time
	lastExitCode  int
	stopRequested bool
	stopTimedOut  bool
	healthyOnce   bool
}

func NewSupervisor(store *config.Store, bus *events.Bus) *Supervisor {
	return NewSupervisorWithOptions(store, bus)
}

func NewSupervisorWithOptions(store *config.Store, bus *events.Bus, options ...Option) *Supervisor {
	supervisor := &Supervisor{
		store:              store,
		launch:             defaultLauncher,
		prepare:            defaultPreflight,
		probe:              defaultProbe,
		terminate:          terminateProcess,
		forceKill:          killProcess,
		probePolicy:        defaultProbeTransitionPolicy,
		startFailPolicy:    defaultStartFailurePolicy,
		stopFailPolicy:     defaultStopSignalFailurePolicy,
		stopNoProcPolicy:   defaultStopNoProcessPolicy,
		stopWaitFailPolicy: defaultStopWaitFailurePolicy,
		exitPolicy:         defaultExitTransitionPolicy,
		probeInterval:      time.Second,
		stopTimeout:        5 * time.Second,
		startupTimeout:     60 * time.Second,
		status:             StatusStopped,
		health:             HealthUnknown,
	}
	if bus != nil {
		supervisor.notifier = &busLifecycleNotifier{bus: bus}
	}
	for _, option := range options {
		option(supervisor)
	}
	return supervisor
}

func WithLauncher(fn func(config.ManagedGatewaySettings) (*exec.Cmd, error)) Option {
	return func(supervisor *Supervisor) {
		supervisor.launch = fn
	}
}

func WithProbe(fn func(context.Context, config.ManagedGatewaySettings) error) Option {
	return func(supervisor *Supervisor) {
		supervisor.probe = fn
	}
}

func WithProcessTerminator(fn func(*exec.Cmd) error) Option {
	return func(supervisor *Supervisor) {
		if fn != nil {
			supervisor.terminate = fn
		}
	}
}

func WithForceKillProcess(fn func(*exec.Cmd) error) Option {
	return func(supervisor *Supervisor) {
		if fn != nil {
			supervisor.forceKill = fn
		}
	}
}

func WithPreflight(fn preflightFunc) Option {
	return func(supervisor *Supervisor) {
		supervisor.prepare = fn
	}
}

func WithProbeInterval(interval time.Duration) Option {
	return func(supervisor *Supervisor) {
		supervisor.probeInterval = interval
	}
}

func WithStartupTimeout(timeout time.Duration) Option {
	return func(supervisor *Supervisor) {
		supervisor.startupTimeout = timeout
	}
}

func WithStopTimeout(timeout time.Duration) Option {
	return func(supervisor *Supervisor) {
		supervisor.stopTimeout = timeout
	}
}

func WithLifecycleNotifier(notifier LifecycleNotifier) Option {
	return func(supervisor *Supervisor) {
		supervisor.notifier = notifier
	}
}

func WithProbeTransitionPolicy(policy ProbeTransitionPolicy) Option {
	return func(supervisor *Supervisor) {
		if policy != nil {
			supervisor.probePolicy = policy
		}
	}
}

func WithStartFailurePolicy(policy StartFailurePolicy) Option {
	return func(supervisor *Supervisor) {
		if policy != nil {
			supervisor.startFailPolicy = policy
		}
	}
}

func WithStopSignalFailurePolicy(policy StopSignalFailurePolicy) Option {
	return func(supervisor *Supervisor) {
		if policy != nil {
			supervisor.stopFailPolicy = policy
		}
	}
}

func WithStopNoProcessPolicy(policy StopNoProcessPolicy) Option {
	return func(supervisor *Supervisor) {
		if policy != nil {
			supervisor.stopNoProcPolicy = policy
		}
	}
}

func WithStopWaitFailurePolicy(policy StopWaitFailurePolicy) Option {
	return func(supervisor *Supervisor) {
		if policy != nil {
			supervisor.stopWaitFailPolicy = policy
		}
	}
}

func WithExitTransitionPolicy(policy ExitTransitionPolicy) Option {
	return func(supervisor *Supervisor) {
		if policy != nil {
			supervisor.exitPolicy = policy
		}
	}
}

func (s *Supervisor) GatewayConnection() (string, string, bool) {
	s.mu.RLock()
	cfg := s.currentConfigLocked()
	status := s.status
	s.mu.RUnlock()
	if status == StatusStopped {
		return "", "", false
	}
	if cfg.Mode != "managed" || strings.TrimSpace(cfg.GatewayToken) == "" {
		return "", "", false
	}
	return config.ManagedGatewayURL(cfg), cfg.GatewayToken, true
}

func (s *Supervisor) Snapshot() Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snapshotLocked()
}

func (s *Supervisor) EnsureAutoStart() {
	cfg := s.store.Effective().ManagedGateway
	if !cfg.AutoStart {
		return
	}
	go func() {
		_, _ = s.Start(context.Background())
	}()
}

func (s *Supervisor) Start(ctx context.Context) (Snapshot, error) {
	s.mu.Lock()
	if s.cmd != nil {
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		return snapshot, nil
	}
	cfg := s.store.Effective().ManagedGateway
	cfg = withManagedStateDir(cfg, s.store.Path())
	s.activeConfig = cfg
	if err := syncManagedGatewayProviderConfig(s.store.Path()); err != nil {
		snapshot := s.applyStartFailureLocked("preflight", err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	if err := validateManagedConfig(cfg); err != nil {
		snapshot := s.applyStartFailureLocked("preflight", err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	if s.prepare != nil {
		if err := s.prepare(ctx, cfg); err != nil {
			snapshot := s.applyStartFailureLocked("preflight", err)
			s.mu.Unlock()
			s.publishStatus(snapshot)
			return snapshot, err
		}
	}

	cmd, err := s.launch(cfg)
	if err != nil {
		snapshot := s.applyStartFailureLocked("launch", err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	if err := cmd.Start(); err != nil {
		snapshot := s.applyStartFailureLocked("launch", err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}

	snapshot := s.beginStartLocked(cmd, time.Now().UTC())
	s.mu.Unlock()

	s.publishStatus(snapshot)
	go s.waitLoop(cmd)
	go s.healthLoop(cmd, cfg)
	return snapshot, nil
}

func (s *Supervisor) Stop(ctx context.Context) (Snapshot, error) {
	s.mu.Lock()
	cmd := s.cmd
	waitDone := s.waitDone
	if cmd == nil || cmd.Process == nil {
		if cmd != nil && waitDone != nil {
			close(waitDone)
			s.waitDone = nil
		}
		s.cmd = nil
		snapshot := s.applyStopNoProcessLocked(cmd != nil, cmd != nil && cmd.Process != nil)
		s.mu.Unlock()
		return snapshot, nil
	}
	s.stopRequested = true
	s.stopTimedOut = false
	s.status = StatusStopping
	s.health = HealthUnknown
	snapshot := s.snapshotLocked()
	s.mu.Unlock()
	s.publishStatus(snapshot)

	if err := s.terminate(cmd); err != nil {
		s.mu.Lock()
		snapshot = s.applyStopSignalFailureLocked(err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}

	select {
	case <-ctx.Done():
		s.mu.Lock()
		snapshot = s.applyStopWaitFailureLocked("ctx-cancelled", false, ctx.Err())
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, ctx.Err()
	case <-waitDone:
		return s.Snapshot(), nil
	case <-time.After(s.stopTimeout):
		s.mu.Lock()
		if s.cmd == cmd {
			s.stopTimedOut = true
		}
		s.mu.Unlock()
		if err := s.forceKill(cmd); err != nil {
			s.mu.Lock()
			snapshot = s.applyStopWaitFailureLocked("force-kill", true, err)
			s.mu.Unlock()
			s.publishStatus(snapshot)
			return snapshot, err
		}
		select {
		case <-waitDone:
			return s.Snapshot(), nil
		case <-ctx.Done():
			s.mu.Lock()
			snapshot = s.applyStopWaitFailureLocked("ctx-cancelled", true, ctx.Err())
			s.mu.Unlock()
			s.publishStatus(snapshot)
			return snapshot, ctx.Err()
		}
	}
}

func (s *Supervisor) Restart(ctx context.Context) (Snapshot, error) {
	if _, err := s.Stop(ctx); err != nil {
		return s.Snapshot(), err
	}
	return s.Start(ctx)
}

func (s *Supervisor) waitLoop(cmd *exec.Cmd) {
	err := cmd.Wait()
	exitAt := time.Now().UTC()
	exitCode := exitCodeFromErr(err)

	s.mu.Lock()
	if s.cmd != cmd {
		s.mu.Unlock()
		return
	}
	s.cmd = nil
	if s.waitDone != nil {
		close(s.waitDone)
		s.waitDone = nil
	}
	s.lastExitAt = exitAt
	s.lastExitCode = exitCode
	s.applyExitTransitionLocked(s.stopRequested, s.stopTimedOut, err, exitCode)
	s.stopTimedOut = false
	s.healthyOnce = false
	snapshot := s.snapshotLocked()
	s.mu.Unlock()

	s.publishExit(snapshot)
	s.publishStatus(snapshot)
}

func (s *Supervisor) healthLoop(cmd *exec.Cmd, cfg config.ManagedGatewaySettings) {
	ticker := time.NewTicker(s.probeInterval)
	defer ticker.Stop()

	s.runHealthProbe(cmd, cfg)

	for range ticker.C {
		s.mu.RLock()
		if s.cmd != cmd {
			s.mu.RUnlock()
			return
		}
		s.mu.RUnlock()
		s.runHealthProbe(cmd, cfg)
	}
}

func (s *Supervisor) runHealthProbe(cmd *exec.Cmd, cfg config.ManagedGatewaySettings) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := s.probe(ctx, cfg)

	s.mu.Lock()
	if s.cmd != cmd {
		s.mu.Unlock()
		return
	}
	decision := s.probePolicy(ProbeTransitionContext{
		Err:            err,
		HealthyOnce:    s.healthyOnce,
		StartedAt:      s.startedAt,
		StartupTimeout: s.startupTimeout,
		Now:            time.Now(),
	})
	s.applyLifecycleFieldsLocked(decision.Status, decision.Health, decision.LastError, decision.FailurePhase)
	s.healthyOnce = decision.HealthyOnce
	snapshot := s.snapshotLocked()
	s.mu.Unlock()

	s.publishHealth(snapshot)
	s.publishStatus(snapshot)
}

func (s *Supervisor) applyStartFailureLocked(stage string, err error) Snapshot {
	decision := s.startFailPolicy(StartFailureContext{
		Stage: stage,
		Err:   err,
	})
	s.applyLifecycleFieldsLocked(decision.Status, decision.Health, decision.LastError, decision.FailurePhase)
	return s.snapshotLocked()
}

func (s *Supervisor) applyStopSignalFailureLocked(err error) Snapshot {
	decision := s.stopFailPolicy(StopSignalFailureContext{Err: err})
	s.applyLifecycleFieldsLocked(decision.Status, decision.Health, decision.LastError, decision.FailurePhase)
	return s.snapshotLocked()
}

func (s *Supervisor) applyStopNoProcessLocked(hasCommand bool, hasProcess bool) Snapshot {
	decision := s.stopNoProcPolicy(StopNoProcessContext{
		HasCommand: hasCommand,
		HasProcess: hasProcess,
	})
	s.applyLifecycleFieldsLocked(decision.Status, decision.Health, decision.LastError, decision.FailurePhase)
	if decision.ClearActiveConfig {
		s.activeConfig = config.ManagedGatewaySettings{}
	}
	return s.snapshotLocked()
}

func (s *Supervisor) applyStopWaitFailureLocked(stage string, timedOut bool, err error) Snapshot {
	decision := s.stopWaitFailPolicy(StopWaitFailureContext{
		Stage:    stage,
		TimedOut: timedOut,
		Err:      err,
	})
	s.applyLifecycleFieldsLocked(decision.Status, decision.Health, decision.LastError, decision.FailurePhase)
	return s.snapshotLocked()
}

func (s *Supervisor) applyExitTransitionLocked(stopRequested bool, stopTimedOut bool, err error, exitCode int) Snapshot {
	decision := s.exitPolicy(ExitTransitionContext{
		StopRequested: stopRequested,
		StopTimedOut:  stopTimedOut,
		Err:           err,
		ExitCode:      exitCode,
	})
	s.applyLifecycleFieldsLocked(decision.Status, decision.Health, decision.LastError, decision.FailurePhase)
	if decision.ClearActiveConfig {
		s.activeConfig = config.ManagedGatewaySettings{}
	}
	return s.snapshotLocked()
}

func (s *Supervisor) beginStartLocked(cmd *exec.Cmd, startedAt time.Time) Snapshot {
	s.cmd = cmd
	s.waitDone = make(chan struct{})
	s.applyLifecycleFieldsLocked(StatusStarting, HealthUnknown, "", "")
	s.startedAt = startedAt
	s.stopRequested = false
	s.stopTimedOut = false
	s.healthyOnce = false
	return s.snapshotLocked()
}

func (s *Supervisor) applyLifecycleFieldsLocked(status Status, health Health, lastError string, failurePhase string) {
	s.status = status
	s.health = health
	s.lastError = lastError
	s.failurePhase = failurePhase
}

func (s *Supervisor) snapshotLocked() Snapshot {
	cfg := s.currentConfigLocked()
	snapshot := Snapshot{
		Managed:      cfg.Mode == "managed",
		Configured:   strings.TrimSpace(cfg.GatewayToken) != "" && strings.TrimSpace(cfg.Command) != "",
		Status:       s.status,
		FailurePhase: s.failurePhase,
		Health:       s.health,
		GatewayURL:   config.ManagedGatewayURL(cfg),
		LastError:    s.lastError,
		AutoStart:    cfg.AutoStart,
	}
	if s.cmd != nil && s.cmd.Process != nil {
		snapshot.PID = s.cmd.Process.Pid
	}
	if !s.startedAt.IsZero() {
		snapshot.StartedAt = s.startedAt.Format(time.RFC3339)
	}
	if !s.lastExitAt.IsZero() {
		snapshot.LastExitAt = s.lastExitAt.Format(time.RFC3339)
		snapshot.LastExitCode = s.lastExitCode
	}
	return normalizeSnapshot(snapshot)
}

func (s *Supervisor) currentConfigLocked() config.ManagedGatewaySettings {
	if s.status != StatusStopped && s.activeConfig.Mode != "" {
		return s.activeConfig
	}
	return withManagedStateDir(s.store.Effective().ManagedGateway, s.store.Path())
}

func (s *Supervisor) publishStatus(snapshot Snapshot) {
	if s.notifier == nil {
		return
	}
	s.notifier.PublishStatus(snapshot)
}

func (s *Supervisor) publishHealth(snapshot Snapshot) {
	if s.notifier == nil {
		return
	}
	s.notifier.PublishHealth(snapshot)
}

func (s *Supervisor) publishExit(snapshot Snapshot) {
	if s.notifier == nil {
		return
	}
	s.notifier.PublishExit(snapshot)
}

type busLifecycleNotifier struct {
	bus *events.Bus
}

func (n *busLifecycleNotifier) PublishStatus(snapshot Snapshot) {
	n.publish("runtime.gateway.status", snapshot)
}

func (n *busLifecycleNotifier) PublishHealth(snapshot Snapshot) {
	n.publish("runtime.gateway.health", snapshot)
}

func (n *busLifecycleNotifier) PublishExit(snapshot Snapshot) {
	n.publish("runtime.gateway.exit", snapshot)
}

func (n *busLifecycleNotifier) publish(eventType string, payload any) {
	if n == nil || n.bus == nil {
		return
	}
	raw, _ := json.Marshal(payload)
	n.bus.Publish(eventType, raw)
}

func defaultProbeTransitionPolicy(input ProbeTransitionContext) ProbeTransitionDecision {
	switch {
	case input.Err == nil:
		return ProbeTransitionDecision{
			Status:       StatusRunning,
			Health:       HealthHealthy,
			LastError:    "",
			FailurePhase: "",
			HealthyOnce:  true,
		}
	case input.HealthyOnce:
		return ProbeTransitionDecision{
			Status:       StatusDegraded,
			Health:       HealthUnhealthy,
			LastError:    input.Err.Error(),
			FailurePhase: "runtime",
			HealthyOnce:  true,
		}
	case !input.StartedAt.IsZero() && input.Now.Sub(input.StartedAt) >= input.StartupTimeout:
		return ProbeTransitionDecision{
			Status:       StatusFailed,
			Health:       HealthUnhealthy,
			LastError:    input.Err.Error(),
			FailurePhase: "runtime",
			HealthyOnce:  false,
		}
	default:
		return ProbeTransitionDecision{
			Status:       StatusStarting,
			Health:       HealthUnhealthy,
			LastError:    input.Err.Error(),
			FailurePhase: "runtime",
			HealthyOnce:  false,
		}
	}
}

func defaultStartFailurePolicy(input StartFailureContext) StartFailureDecision {
	lastError := ""
	if input.Err != nil {
		lastError = input.Err.Error()
	}
	return StartFailureDecision{
		Status:       StatusFailed,
		Health:       HealthUnknown,
		LastError:    lastError,
		FailurePhase: input.Stage,
	}
}

func defaultStopSignalFailurePolicy(StopSignalFailureContext) StopSignalFailureDecision {
	return StopSignalFailureDecision{
		Status:       StatusStopping,
		Health:       HealthUnknown,
		LastError:    "",
		FailurePhase: "",
	}
}

func defaultStopNoProcessPolicy(StopNoProcessContext) StopNoProcessDecision {
	return StopNoProcessDecision{
		Status:            StatusStopped,
		Health:            HealthUnknown,
		LastError:         "",
		FailurePhase:      "",
		ClearActiveConfig: false,
	}
}

func defaultStopWaitFailurePolicy(StopWaitFailureContext) StopWaitFailureDecision {
	return StopWaitFailureDecision{
		Status:       StatusStopping,
		Health:       HealthUnknown,
		LastError:    "",
		FailurePhase: "",
	}
}

func defaultExitTransitionPolicy(input ExitTransitionContext) ExitTransitionDecision {
	lastError := ""
	if input.Err != nil {
		lastError = input.Err.Error()
	}
	if input.StopRequested {
		return ExitTransitionDecision{
			Status:            StatusStopped,
			Health:            HealthUnknown,
			LastError:         "",
			FailurePhase:      "",
			ClearActiveConfig: true,
		}
	}
	return ExitTransitionDecision{
		Status:            StatusFailed,
		Health:            HealthUnknown,
		LastError:         lastError,
		FailurePhase:      "runtime",
		ClearActiveConfig: false,
	}
}

func normalizeSnapshot(snapshot Snapshot) Snapshot {
	if snapshot.Status == "" {
		snapshot.Status = StatusStopped
	}
	if snapshot.Health == "" {
		snapshot.Health = HealthUnknown
	}
	return snapshot
}

func validateManagedConfig(cfg config.ManagedGatewaySettings) error {
	if cfg.Mode != "" && cfg.Mode != "managed" {
		return errors.New("only managed gateway mode is supported")
	}
	if strings.TrimSpace(cfg.Command) == "" {
		return errors.New("managed gateway command is required")
	}
	if strings.TrimSpace(cfg.GatewayToken) == "" {
		return errors.New("managed gateway token is required")
	}
	return nil
}

func defaultLauncher(cfg config.ManagedGatewaySettings) (*exec.Cmd, error) {
	if err := validateManagedConfig(cfg); err != nil {
		return nil, err
	}
	cmd := exec.Command(cfg.Command, launchArgs(cfg)...)
	if cfg.WorkingDir != "" {
		cmd.Dir = cfg.WorkingDir
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(), managedEnv(cfg)...)
	return cmd, nil
}

func defaultProbe(ctx context.Context, cfg config.ManagedGatewaySettings) error {
	return runtimetransport.ProbeManagedHealth(ctx, cfg)
}

func managedEnv(cfg config.ManagedGatewaySettings) []string {
	env := make([]string, 0, len(cfg.Env)+5)
	hasNpmCache := false
	for key, value := range cfg.Env {
		if key == "NPM_CONFIG_CACHE" || key == "npm_config_cache" {
			hasNpmCache = true
		}
		env = append(env, key+"="+value)
	}
	if !hasNpmCache && strings.TrimSpace(os.Getenv("NPM_CONFIG_CACHE")) == "" && strings.TrimSpace(os.Getenv("npm_config_cache")) == "" {
		cacheDir := filepath.Join(os.TempDir(), "deck-go-npm-cache")
		_ = os.MkdirAll(cacheDir, 0o755)
		env = append(env, "NPM_CONFIG_CACHE="+cacheDir, "npm_config_cache="+cacheDir)
	}
	env = append(env, "OPENCLAW_GATEWAY_TOKEN="+cfg.GatewayToken)
	env = append(env, "NO_PROXY=localhost,127.0.0.1,::1")
	env = append(env, "no_proxy=localhost,127.0.0.1,::1")
	return env
}

func launchArgs(cfg config.ManagedGatewaySettings) []string {
	args := append([]string(nil), cfg.Args...)
	hasExplicitAuthArg := false
	for _, arg := range args {
		if arg == "--token" || arg == "--password" || strings.HasPrefix(arg, "--token=") || strings.HasPrefix(arg, "--password=") {
			hasExplicitAuthArg = true
			break
		}
	}
	if !hasExplicitAuthArg && strings.TrimSpace(cfg.GatewayToken) != "" {
		args = append(args, "--token", cfg.GatewayToken)
	}
	return args
}

func withManagedStateDir(cfg config.ManagedGatewaySettings, settingsPath string) config.ManagedGatewaySettings {
	next := cfg
	if next.Env == nil {
		next.Env = map[string]string{}
	} else {
		cloned := make(map[string]string, len(next.Env))
		for key, value := range next.Env {
			cloned[key] = value
		}
		next.Env = cloned
	}
	stateDir := filepath.Join(filepath.Dir(settingsPath), "managed-gateway-state")
	_ = os.MkdirAll(stateDir, 0o755)
	next.Env["OPENCLAW_STATE_DIR"] = stateDir
	return next
}

func exitCodeFromErr(err error) int {
	if err == nil {
		return 0
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		if status, ok := exitErr.Sys().(syscall.WaitStatus); ok {
			return status.ExitStatus()
		}
	}
	return -1
}

func terminateProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if err := cmd.Process.Signal(os.Interrupt); err != nil {
		return cmd.Process.Kill()
	}
	return nil
}

func killProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	return cmd.Process.Kill()
}
