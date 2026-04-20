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
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
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

type Supervisor struct {
	store *config.Store
	bus   *events.Bus

	launch         launcher
	prepare        preflightFunc
	probe          probeFunc
	probeInterval  time.Duration
	stopTimeout    time.Duration
	startupTimeout time.Duration

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
	healthyOnce   bool
}

func NewSupervisor(store *config.Store, bus *events.Bus) *Supervisor {
	return NewSupervisorWithOptions(store, bus)
}

func NewSupervisorWithOptions(store *config.Store, bus *events.Bus, options ...Option) *Supervisor {
	supervisor := &Supervisor{
		store:          store,
		bus:            bus,
		launch:         defaultLauncher,
		prepare:        defaultPreflight,
		probe:          defaultProbe,
		probeInterval:  time.Second,
		stopTimeout:    5 * time.Second,
		startupTimeout: 60 * time.Second,
		status:         StatusStopped,
		health:         HealthUnknown,
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
		s.status = StatusFailed
		s.health = HealthUnknown
		s.lastError = err.Error()
		s.failurePhase = "preflight"
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	if err := validateManagedConfig(cfg); err != nil {
		s.status = StatusFailed
		s.health = HealthUnknown
		s.lastError = err.Error()
		s.failurePhase = "preflight"
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	if s.prepare != nil {
		if err := s.prepare(ctx, cfg); err != nil {
			s.status = StatusFailed
			s.health = HealthUnknown
			s.lastError = err.Error()
			s.failurePhase = "preflight"
			snapshot := s.snapshotLocked()
			s.mu.Unlock()
			s.publishStatus(snapshot)
			return snapshot, err
		}
	}

	cmd, err := s.launch(cfg)
	if err != nil {
		s.status = StatusFailed
		s.health = HealthUnknown
		s.lastError = err.Error()
		s.failurePhase = "launch"
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	if err := cmd.Start(); err != nil {
		s.status = StatusFailed
		s.health = HealthUnknown
		s.lastError = err.Error()
		s.failurePhase = "launch"
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}

	now := time.Now().UTC()
	s.cmd = cmd
	s.waitDone = make(chan struct{})
	s.status = StatusStarting
	s.health = HealthUnknown
	s.lastError = ""
	s.failurePhase = ""
	s.startedAt = now
	s.stopRequested = false
	s.healthyOnce = false
	snapshot := s.snapshotLocked()
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
	if cmd == nil {
		s.status = StatusStopped
		s.health = HealthUnknown
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		return snapshot, nil
	}
	s.stopRequested = true
	s.status = StatusStopping
	s.health = HealthUnknown
	snapshot := s.snapshotLocked()
	s.mu.Unlock()
	s.publishStatus(snapshot)

	if err := terminateProcess(cmd); err != nil {
		return s.Snapshot(), err
	}

	select {
	case <-ctx.Done():
		return s.Snapshot(), ctx.Err()
	case <-waitDone:
		return s.Snapshot(), nil
	case <-time.After(s.stopTimeout):
		_ = cmd.Process.Kill()
		select {
		case <-waitDone:
			return s.Snapshot(), nil
		case <-ctx.Done():
			return s.Snapshot(), ctx.Err()
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
	if s.stopRequested {
		s.status = StatusStopped
		s.lastError = ""
		s.failurePhase = ""
		s.activeConfig = config.ManagedGatewaySettings{}
	} else {
		s.status = StatusFailed
		if err != nil {
			s.lastError = err.Error()
		}
		s.failurePhase = "runtime"
	}
	s.health = HealthUnknown
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
	switch {
	case err == nil:
		s.health = HealthHealthy
		s.lastError = ""
		s.failurePhase = ""
		if !s.healthyOnce {
			s.healthyOnce = true
		}
		s.status = StatusRunning
	case s.healthyOnce:
		s.health = HealthUnhealthy
		s.status = StatusDegraded
		s.lastError = err.Error()
		s.failurePhase = "runtime"
	case !s.startedAt.IsZero() && time.Since(s.startedAt) >= s.startupTimeout:
		s.health = HealthUnhealthy
		s.status = StatusFailed
		s.lastError = err.Error()
		s.failurePhase = "runtime"
	default:
		s.health = HealthUnhealthy
		s.status = StatusStarting
		s.lastError = err.Error()
		s.failurePhase = "runtime"
	}
	snapshot := s.snapshotLocked()
	s.mu.Unlock()

	s.publishHealth(snapshot)
	s.publishStatus(snapshot)
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
	if snapshot.Status == "" {
		snapshot.Status = StatusStopped
	}
	if snapshot.Health == "" {
		snapshot.Health = HealthUnknown
	}
	return snapshot
}

func (s *Supervisor) currentConfigLocked() config.ManagedGatewaySettings {
	if s.status != StatusStopped && s.activeConfig.Mode != "" {
		return s.activeConfig
	}
	return withManagedStateDir(s.store.Effective().ManagedGateway, s.store.Path())
}

func (s *Supervisor) publishStatus(snapshot Snapshot) {
	s.publish("runtime.gateway.status", snapshot)
}

func (s *Supervisor) publishHealth(snapshot Snapshot) {
	s.publish("runtime.gateway.health", snapshot)
}

func (s *Supervisor) publishExit(snapshot Snapshot) {
	s.publish("runtime.gateway.exit", snapshot)
}

func (s *Supervisor) publish(eventType string, payload any) {
	if s.bus == nil {
		return
	}
	raw, _ := json.Marshal(payload)
	s.bus.Publish(eventType, raw)
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
	return gateway.ProbeHealth(ctx, config.ManagedGatewayURL(cfg), cfg.GatewayToken)
}

func managedEnv(cfg config.ManagedGatewaySettings) []string {
	env := make([]string, 0, len(cfg.Env)+2)
	for key, value := range cfg.Env {
		env = append(env, key+"="+value)
	}
	env = append(env, "OPENCLAW_GATEWAY_TOKEN="+cfg.GatewayToken)
	env = append(env, "NO_PROXY=localhost,127.0.0.1")
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
