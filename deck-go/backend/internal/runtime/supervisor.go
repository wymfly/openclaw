package runtimecontrol

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
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

type FailurePhase string

const (
	FailurePhaseNone      FailurePhase = ""
	FailurePhasePreflight FailurePhase = "preflight"
	FailurePhaseLaunch    FailurePhase = "launch"
	FailurePhaseOwnership FailurePhase = "ownership"
	FailurePhaseRuntime   FailurePhase = "runtime"
)

type Snapshot struct {
	Managed         bool         `json:"managed"`
	Configured      bool         `json:"configured,omitempty"`
	Status          Status       `json:"status,omitempty"`
	FailurePhase    FailurePhase `json:"failurePhase,omitempty"`
	PID             int    `json:"pid,omitempty"`
	StartedAt       string `json:"startedAt,omitempty"`
	LastExitAt      string `json:"lastExitAt,omitempty"`
	LastExitCode    int    `json:"lastExitCode,omitempty"`
	Health          Health `json:"health,omitempty"`
	GatewayURL      string `json:"gatewayUrl,omitempty"`
	LastError       string `json:"lastError,omitempty"`
	AutoStart       bool   `json:"autoStart,omitempty"`
	Owner           string `json:"owner,omitempty"`
	OwnershipState  string `json:"ownershipState,omitempty"`
	OwnershipFile   string `json:"ownershipFile,omitempty"`
	RestartAttempts int    `json:"restartAttempts,omitempty"`
	RestartDelayMs  int    `json:"restartDelayMs,omitempty"`
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
	FailurePhase FailurePhase
	HealthyOnce  bool
}
type ProbeTransitionPolicy func(ProbeTransitionContext) ProbeTransitionDecision
type StartFailureContext struct {
	Stage FailurePhase
	Err   error
}
type StartFailureDecision struct {
	Status       Status
	Health       Health
	LastError    string
	FailurePhase FailurePhase
}
type StartFailurePolicy func(StartFailureContext) StartFailureDecision
type StopSignalFailureContext struct {
	Err error
}
type StopSignalFailureDecision struct {
	Status       Status
	Health       Health
	LastError    string
	FailurePhase FailurePhase
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
	FailurePhase      FailurePhase
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
	FailurePhase FailurePhase
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
	FailurePhase      FailurePhase
	ClearActiveConfig bool
}
type ExitTransitionPolicy func(ExitTransitionContext) ExitTransitionDecision
type processTerminator func(*exec.Cmd) error

type Supervisor struct {
	store *config.Store

	notifier              LifecycleNotifier
	launch                launcher
	prepare               preflightFunc
	probe                 probeFunc
	terminate             processTerminator
	forceKill             processTerminator
	probePolicy           ProbeTransitionPolicy
	startFailPolicy       StartFailurePolicy
	stopFailPolicy        StopSignalFailurePolicy
	stopNoProcPolicy      StopNoProcessPolicy
	stopWaitFailPolicy    StopWaitFailurePolicy
	exitPolicy            ExitTransitionPolicy
	probeInterval         time.Duration
	stopTimeout           time.Duration
	startupTimeout        time.Duration
	restartMaxAttempts    int
	restartInitialDelay   time.Duration
	restartMaxDelay       time.Duration
	unhealthyRestartAfter time.Duration
	backoffResetAfter     time.Duration

	mu               sync.RWMutex
	cmd              *exec.Cmd
	waitDone         chan struct{}
	activeConfig     config.ManagedGatewaySettings
	adoptedPID       int
	status           Status
	health           Health
	lastError        string
	failurePhase     FailurePhase
	startedAt        time.Time
	lastExitAt       time.Time
	lastExitCode     int
	stopRequested    bool
	stopTimedOut     bool
	healthyOnce      bool
	restartScheduled bool
	restartDelay     time.Duration
	restartAttempts  int
	unhealthySince   time.Time
	healthySince     time.Time
}

func NewSupervisor(store *config.Store, bus *events.Bus) *Supervisor {
	return NewSupervisorWithOptions(store, bus)
}

func NewSupervisorWithOptions(store *config.Store, bus *events.Bus, options ...Option) *Supervisor {
	supervisor := &Supervisor{
		store:                 store,
		launch:                defaultLauncher,
		prepare:               defaultPreflight,
		probe:                 defaultProbe,
		terminate:             terminateProcess,
		forceKill:             killProcess,
		probePolicy:           defaultProbeTransitionPolicy,
		startFailPolicy:       defaultStartFailurePolicy,
		stopFailPolicy:        defaultStopSignalFailurePolicy,
		stopNoProcPolicy:      defaultStopNoProcessPolicy,
		stopWaitFailPolicy:    defaultStopWaitFailurePolicy,
		exitPolicy:            defaultExitTransitionPolicy,
		probeInterval:         time.Second,
		stopTimeout:           5 * time.Second,
		startupTimeout:        60 * time.Second,
		restartMaxAttempts:    3,
		restartInitialDelay:   100 * time.Millisecond,
		restartMaxDelay:       1 * time.Second,
		unhealthyRestartAfter: 30 * time.Second,
		backoffResetAfter:     2 * time.Minute,
		status:                StatusStopped,
		health:                HealthUnknown,
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
	return s.start(ctx, true)
}

func (s *Supervisor) start(ctx context.Context, resetRestart bool) (Snapshot, error) {
	s.mu.Lock()
	if s.cmd != nil {
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		return snapshot, nil
	}
	if resetRestart {
		s.restartAttempts = 0
		s.restartScheduled = false
		s.restartDelay = 0
		s.stopRequested = false
	}
	cfg := s.store.Effective().ManagedGateway
	cfg = withManagedStateDir(cfg, s.store.Path())
	if err := validateManagedConfig(cfg); err != nil {
		snapshot := s.applyStartFailureLocked(FailurePhasePreflight, err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	s.activeConfig = cfg
	if metadata, ok, mismatchReason := readAdoptableOwnershipMetadata(s.store.Path(), cfg); ok {
		s.mu.Unlock()
		probeErr := s.probe(ctx, cfg)
		s.mu.Lock()
		if s.cmd != nil {
			snapshot := s.snapshotLocked()
			s.mu.Unlock()
			return snapshot, nil
		}
		alive := managedProcessAlive(metadata.PID)
		if probeErr == nil && alive {
			snapshot := s.beginAdoptLocked(metadata, cfg)
			s.mu.Unlock()
			s.publishStatus(snapshot)
			go s.adoptedHealthLoop(metadata.PID, cfg)
			return snapshot, nil
		}
		switch {
		case !alive:
			log.Printf("supervisor: adoption rejected: pid %d no longer alive (stale ownership metadata)", metadata.PID)
		case probeErr != nil:
			log.Printf("supervisor: adoption rejected (pid=%d): authenticated probe failed: %v", metadata.PID, probeErr)
		}
	} else if mismatchReason != "" {
		log.Printf("supervisor: adoption rejected: %s", mismatchReason)
	}
	if err := syncManagedGatewayProviderConfig(s.store.Path()); err != nil {
		snapshot := s.applyStartFailureLocked(FailurePhasePreflight, err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	if s.prepare != nil {
		if err := s.prepare(ctx, cfg); err != nil {
			snapshot := s.applyStartFailureLocked(FailurePhasePreflight, err)
			s.mu.Unlock()
			s.publishStatus(snapshot)
			return snapshot, err
		}
	}

	cmd, err := s.launch(cfg)
	if err != nil {
		snapshot := s.applyStartFailureLocked(FailurePhaseLaunch, err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}
	if err := cmd.Start(); err != nil {
		snapshot := s.applyStartFailureLocked(FailurePhaseLaunch, err)
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}

	startedAt := time.Now().UTC()
	if err := writeOwnershipMetadata(s.store.Path(), cfg, cmd.Process.Pid, startedAt); err != nil {
		log.Printf("supervisor: ownership metadata write failed (pid=%d): %v", cmd.Process.Pid, err)
		if killErr := cmd.Process.Kill(); killErr != nil {
			log.Printf("supervisor: failed to kill spawned gateway after ownership write failure (pid=%d): %v", cmd.Process.Pid, killErr)
		}
		if waitErr := cmd.Wait(); waitErr != nil && !errors.Is(waitErr, syscall.ECHILD) {
			log.Printf("supervisor: wait failed for orphaned gateway (pid=%d): %v", cmd.Process.Pid, waitErr)
		}
		snapshot := s.applyStartFailureLocked(FailurePhaseOwnership, fmt.Errorf("write ownership metadata: %w", err))
		s.mu.Unlock()
		s.publishStatus(snapshot)
		return snapshot, err
	}

	snapshot := s.beginStartLocked(cmd, startedAt)
	s.mu.Unlock()

	s.publishStatus(snapshot)
	go s.waitLoop(cmd)
	go s.healthLoop(cmd, cfg)
	return snapshot, nil
}

func (s *Supervisor) Stop(ctx context.Context) (Snapshot, error) {
	s.mu.Lock()
	cmd := s.cmd
	adoptedPID := s.adoptedPID
	waitDone := s.waitDone
	if cmd == nil && adoptedPID > 0 {
		s.stopRequested = true
		s.restartScheduled = false
		s.restartDelay = 0
		s.status = StatusStopping
		s.health = HealthUnknown
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		s.publishStatus(snapshot)
		logOwnershipStatusUpdate(s.store.Path(), snapshot.Status, snapshot.Health)

		if err := interruptManagedPID(adoptedPID); err != nil {
			s.mu.Lock()
			snapshot = s.applyStopSignalFailureLocked(err)
			s.mu.Unlock()
			s.publishStatus(snapshot)
			return snapshot, err
		}

		timedOut := false
		if err := waitForManagedPIDExit(ctx, adoptedPID, s.stopTimeout); err != nil {
			timedOut = true
			log.Printf("supervisor: adopted gateway pid=%d did not exit cleanly within %s: %v; force-killing", adoptedPID, s.stopTimeout, err)
			if killErr := killManagedPIDGroup(adoptedPID); killErr != nil {
				log.Printf("supervisor: force-kill of adopted gateway pid=%d failed: %v", adoptedPID, killErr)
				s.mu.Lock()
				snapshot = s.applyStopWaitFailureLocked("force-kill", true, killErr)
				s.mu.Unlock()
				s.publishStatus(snapshot)
				return snapshot, killErr
			}
		}

		s.mu.Lock()
		if s.adoptedPID == adoptedPID {
			s.adoptedPID = 0
		}
		s.stopTimedOut = timedOut
		s.applyExitTransitionLocked(true, timedOut, nil, 0)
		s.stopTimedOut = false
		snapshot = s.snapshotLocked()
		s.mu.Unlock()
		logOwnershipRemove(s.store.Path())
		s.publishExit(snapshot)
		s.publishStatus(snapshot)
		return snapshot, nil
	}
	if cmd == nil || cmd.Process == nil {
		s.stopRequested = true
		s.restartScheduled = false
		s.restartDelay = 0
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
	s.restartScheduled = false
	s.restartDelay = 0
	s.status = StatusStopping
	s.health = HealthUnknown
	snapshot := s.snapshotLocked()
	s.mu.Unlock()
	s.publishStatus(snapshot)
	logOwnershipStatusUpdate(s.store.Path(), snapshot.Status, snapshot.Health)

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
	shouldRestart, restartDelay := s.scheduleRestartLocked()
	removeOwnership := !shouldRestart
	snapshot := s.snapshotLocked()
	s.mu.Unlock()

	if removeOwnership {
		logOwnershipRemove(s.store.Path())
	} else {
		logOwnershipStatusUpdate(s.store.Path(), snapshot.Status, snapshot.Health)
	}
	s.publishExit(snapshot)
	s.publishStatus(snapshot)
	if shouldRestart {
		go s.restartAfterDelay(restartDelay)
	}
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

	var replaceCmd *exec.Cmd
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
	now := time.Now()
	if s.applyRecoveryHealthAccountingLocked(decision.Health, now) {
		s.applyLifecycleFieldsLocked(
			StatusStarting,
			HealthUnhealthy,
			"managed gateway remained unhealthy; replacing owned process",
			FailurePhaseRuntime,
		)
		replaceCmd = cmd
	}
	snapshot := s.snapshotLocked()
	s.mu.Unlock()

	s.publishHealth(snapshot)
	s.publishStatus(snapshot)
	logOwnershipStatusUpdate(s.store.Path(), snapshot.Status, snapshot.Health)
	if replaceCmd != nil {
		if err := s.forceKill(replaceCmd); err != nil {
			log.Printf("supervisor: replacement force-kill of unhealthy owned gateway failed: %v; gateway may continue holding port", err)
		}
	}
}

func (s *Supervisor) applyStartFailureLocked(stage FailurePhase, err error) Snapshot {
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
	if s.hasUnownedListenerConflictLocked() {
		s.applyLifecycleFieldsLocked(
			StatusFailed,
			HealthUnknown,
			"no owned managed gateway process to stop; unowned listener remains",
			FailurePhasePreflight,
		)
		return s.snapshotLocked()
	}
	decision := s.stopNoProcPolicy(StopNoProcessContext{
		HasCommand: hasCommand,
		HasProcess: hasProcess,
	})
	s.applyLifecycleFieldsLocked(decision.Status, decision.Health, decision.LastError, decision.FailurePhase)
	if decision.ClearActiveConfig {
		s.activeConfig = config.ManagedGatewaySettings{}
		s.adoptedPID = 0
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
		s.adoptedPID = 0
	}
	return s.snapshotLocked()
}

func (s *Supervisor) beginStartLocked(cmd *exec.Cmd, startedAt time.Time) Snapshot {
	s.cmd = cmd
	s.adoptedPID = 0
	s.waitDone = make(chan struct{})
	s.applyLifecycleFieldsLocked(StatusStarting, HealthUnknown, "", "")
	s.startedAt = startedAt
	s.stopRequested = false
	s.stopTimedOut = false
	s.healthyOnce = false
	s.restartScheduled = false
	s.restartDelay = 0
	s.unhealthySince = time.Time{}
	s.healthySince = time.Time{}
	return s.snapshotLocked()
}

func (s *Supervisor) beginAdoptLocked(metadata ownershipMetadata, cfg config.ManagedGatewaySettings) Snapshot {
	s.cmd = nil
	s.waitDone = nil
	s.adoptedPID = metadata.PID
	s.activeConfig = cfg
	s.applyLifecycleFieldsLocked(StatusRunning, HealthHealthy, "", "")
	if startedAt, err := time.Parse(time.RFC3339, metadata.StartedAt); err == nil {
		s.startedAt = startedAt
	} else {
		s.startedAt = time.Now().UTC()
	}
	s.stopRequested = false
	s.stopTimedOut = false
	s.healthyOnce = true
	s.restartScheduled = false
	s.restartDelay = 0
	s.unhealthySince = time.Time{}
	s.healthySince = time.Now().UTC()
	return s.snapshotLocked()
}

func (s *Supervisor) scheduleRestartLocked() (bool, time.Duration) {
	if s.stopRequested || !s.activeConfig.AutoStart || s.restartMaxAttempts <= 0 {
		return false, 0
	}
	if s.restartAttempts >= s.restartMaxAttempts {
		return false, 0
	}
	s.restartAttempts++
	delay := s.restartBackoffLocked(s.restartAttempts)
	s.restartScheduled = true
	s.restartDelay = delay
	s.applyLifecycleFieldsLocked(
		StatusStarting,
		HealthUnhealthy,
		fmt.Sprintf("managed gateway exited; restart %d/%d scheduled in %s", s.restartAttempts, s.restartMaxAttempts, delay),
		FailurePhaseRuntime,
	)
	return true, delay
}

func (s *Supervisor) restartBackoffLocked(attempt int) time.Duration {
	delay := s.restartInitialDelay
	for i := 1; i < attempt; i++ {
		delay *= 2
		if delay >= s.restartMaxDelay {
			return s.restartMaxDelay
		}
	}
	if delay <= 0 {
		return 0
	}
	if delay > s.restartMaxDelay {
		return s.restartMaxDelay
	}
	return delay
}

func (s *Supervisor) restartAfterDelay(delay time.Duration) {
	if delay > 0 {
		timer := time.NewTimer(delay)
		<-timer.C
	}
	s.mu.Lock()
	if !s.restartScheduled || s.stopRequested || s.cmd != nil {
		s.mu.Unlock()
		return
	}
	s.restartScheduled = false
	s.restartDelay = 0
	s.mu.Unlock()
	_, _ = s.start(context.Background(), false)
}

func (s *Supervisor) applyRecoveryHealthAccountingLocked(health Health, now time.Time) bool {
	switch health {
	case HealthHealthy:
		s.unhealthySince = time.Time{}
		if s.healthySince.IsZero() {
			s.healthySince = now
		}
		if s.restartAttempts > 0 && s.backoffResetAfter > 0 && now.Sub(s.healthySince) >= s.backoffResetAfter {
			s.restartAttempts = 0
		}
		return false
	case HealthUnhealthy:
		s.healthySince = time.Time{}
		if !s.activeConfig.AutoStart || !s.healthyOnce || s.unhealthyRestartAfter <= 0 {
			return false
		}
		if s.unhealthySince.IsZero() {
			s.unhealthySince = now
			return false
		}
		return now.Sub(s.unhealthySince) >= s.unhealthyRestartAfter
	default:
		s.healthySince = time.Time{}
		return false
	}
}

func (s *Supervisor) adoptedHealthLoop(pid int, cfg config.ManagedGatewaySettings) {
	ticker := time.NewTicker(s.probeInterval)
	defer ticker.Stop()

	s.runAdoptedHealthProbe(pid, cfg)
	for range ticker.C {
		s.mu.RLock()
		if s.adoptedPID != pid {
			s.mu.RUnlock()
			return
		}
		s.mu.RUnlock()
		s.runAdoptedHealthProbe(pid, cfg)
	}
}

func (s *Supervisor) runAdoptedHealthProbe(pid int, cfg config.ManagedGatewaySettings) {
	if !managedProcessAlive(pid) {
		exitAt := time.Now().UTC()
		s.mu.Lock()
		if s.adoptedPID != pid {
			s.mu.Unlock()
			return
		}
		s.adoptedPID = 0
		s.lastExitAt = exitAt
		s.lastExitCode = -1
		s.applyExitTransitionLocked(s.stopRequested, s.stopTimedOut, errors.New("adopted managed gateway exited"), -1)
		s.stopTimedOut = false
		s.healthyOnce = false
		shouldRestart, restartDelay := s.scheduleRestartLocked()
		removeOwnership := !shouldRestart
		snapshot := s.snapshotLocked()
		s.mu.Unlock()
		if removeOwnership {
			logOwnershipRemove(s.store.Path())
		} else {
			logOwnershipStatusUpdate(s.store.Path(), snapshot.Status, snapshot.Health)
		}
		s.publishExit(snapshot)
		s.publishStatus(snapshot)
		if shouldRestart {
			go s.restartAfterDelay(restartDelay)
		}
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := s.probe(ctx, cfg)

	replacePID := 0
	s.mu.Lock()
	if s.adoptedPID != pid {
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
	if s.applyRecoveryHealthAccountingLocked(decision.Health, time.Now()) {
		s.applyLifecycleFieldsLocked(
			StatusStarting,
			HealthUnhealthy,
			"managed gateway remained unhealthy; replacing adopted process",
			FailurePhaseRuntime,
		)
		replacePID = pid
	}
	snapshot := s.snapshotLocked()
	s.mu.Unlock()

	s.publishHealth(snapshot)
	s.publishStatus(snapshot)
	logOwnershipStatusUpdate(s.store.Path(), snapshot.Status, snapshot.Health)
	if replacePID > 0 {
		if err := killManagedPIDGroup(replacePID); err != nil {
			log.Printf("supervisor: replacement kill of unhealthy adopted gateway pid=%d failed: %v; gateway may continue holding port %d", replacePID, err, cfg.BindPort)
		}
	}
}

func (s *Supervisor) applyLifecycleFieldsLocked(status Status, health Health, lastError string, failurePhase FailurePhase) {
	s.status = status
	s.health = health
	s.lastError = lastError
	s.failurePhase = failurePhase
}

func (s *Supervisor) snapshotLocked() Snapshot {
	cfg := s.currentConfigLocked()
	snapshot := Snapshot{
		Managed:         cfg.Mode == "managed",
		Configured:      strings.TrimSpace(cfg.GatewayToken) != "" && strings.TrimSpace(cfg.Command) != "",
		Status:          s.status,
		FailurePhase:    s.failurePhase,
		Health:          s.health,
		GatewayURL:      config.ManagedGatewayURL(cfg),
		LastError:       s.lastError,
		AutoStart:       cfg.AutoStart,
		Owner:           "deck-go",
		OwnershipState:  s.ownershipStateLocked(),
		OwnershipFile:   ownershipMetadataPath(s.store.Path()),
		RestartAttempts: s.restartAttempts,
	}
	if s.restartScheduled && s.restartDelay > 0 {
		snapshot.RestartDelayMs = int(s.restartDelay / time.Millisecond)
	}
	if s.cmd != nil && s.cmd.Process != nil {
		snapshot.PID = s.cmd.Process.Pid
	} else if s.adoptedPID > 0 {
		snapshot.PID = s.adoptedPID
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

func (s *Supervisor) ownershipStateLocked() string {
	if s.adoptedPID > 0 {
		return "adopted"
	}
	if s.cmd != nil || s.restartScheduled || s.status == StatusStarting || s.status == StatusRunning || s.status == StatusDegraded || s.status == StatusStopping {
		return "owned"
	}
	if s.hasUnownedListenerConflictLocked() {
		return "external"
	}
	return "none"
}

func (s *Supervisor) hasUnownedListenerConflictLocked() bool {
	return s.status == StatusFailed &&
		s.failurePhase == FailurePhasePreflight &&
		(strings.Contains(s.lastError, "already in use") ||
			strings.Contains(s.lastError, "unowned listener remains"))
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
			FailurePhase: FailurePhaseRuntime,
			HealthyOnce:  true,
		}
	case !input.StartedAt.IsZero() && input.Now.Sub(input.StartedAt) >= input.StartupTimeout:
		return ProbeTransitionDecision{
			Status:       StatusFailed,
			Health:       HealthUnhealthy,
			LastError:    input.Err.Error(),
			FailurePhase: FailurePhaseRuntime,
			HealthyOnce:  false,
		}
	default:
		return ProbeTransitionDecision{
			Status:       StatusStarting,
			Health:       HealthUnhealthy,
			LastError:    input.Err.Error(),
			FailurePhase: FailurePhaseRuntime,
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
		FailurePhase:      FailurePhaseRuntime,
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
	configureManagedProcessGroup(cmd)
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
	stripped, removed := stripAuthArgs(cfg.Args)
	if len(removed) > 0 {
		log.Printf("supervisor: stripped secret-bearing args from managed gateway launch (%v); token must come from OPENCLAW_GATEWAY_TOKEN", removed)
	}
	return stripped
}

func stripAuthArgs(args []string) (kept []string, removed []string) {
	kept = make([]string, 0, len(args))
	skipNext := false
	for _, arg := range args {
		if skipNext {
			skipNext = false
			continue
		}
		if arg == "--token" || arg == "--password" {
			removed = append(removed, arg)
			skipNext = true
			continue
		}
		if strings.HasPrefix(arg, "--token=") || strings.HasPrefix(arg, "--password=") {
			prefix := strings.SplitN(arg, "=", 2)[0]
			removed = append(removed, prefix)
			continue
		}
		kept = append(kept, arg)
	}
	return kept, removed
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
	_ = os.MkdirAll(stateDir, 0o700)
	_ = os.Chmod(stateDir, 0o700)
	next.Env["OPENCLAW_STATE_DIR"] = stateDir
	return next
}

type ownershipMetadata struct {
	Owner             string   `json:"owner"`
	PID               int      `json:"pid"`
	StartedAt         string   `json:"startedAt"`
	UpdatedAt         string   `json:"updatedAt"`
	GatewayURL        string   `json:"gatewayUrl"`
	BindHost          string   `json:"bindHost"`
	BindPort          int      `json:"bindPort"`
	StateDir          string   `json:"stateDir"`
	Command           string   `json:"command"`
	Args              []string `json:"args"`
	LaunchFingerprint string   `json:"launchFingerprint"`
	TokenHash         string   `json:"tokenHash"`
	LastStatus        string   `json:"lastStatus"`
	LastHealth        string   `json:"lastHealth"`
}

func writeOwnershipMetadata(settingsPath string, cfg config.ManagedGatewaySettings, pid int, startedAt time.Time) error {
	path := ownershipMetadataPath(settingsPath)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	if err := os.Chmod(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	payload := ownershipMetadata{
		Owner:             "deck-go",
		PID:               pid,
		StartedAt:         startedAt.Format(time.RFC3339),
		UpdatedAt:         startedAt.Format(time.RFC3339),
		GatewayURL:        config.ManagedGatewayURL(cfg),
		BindHost:          cfg.BindHost,
		BindPort:          cfg.BindPort,
		StateDir:          cfg.Env["OPENCLAW_STATE_DIR"],
		Command:           cfg.Command,
		Args:              launchArgs(cfg),
		LaunchFingerprint: launchFingerprint(cfg),
		TokenHash:         tokenHash(cfg.GatewayToken),
		LastStatus:        string(StatusStarting),
		LastHealth:        string(HealthUnknown),
	}
	return writeOwnershipMetadataPayload(path, payload)
}

func readAdoptableOwnershipMetadata(settingsPath string, cfg config.ManagedGatewaySettings) (ownershipMetadata, bool, string) {
	path := ownershipMetadataPath(settingsPath)
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ownershipMetadata{}, false, ""
		}
		return ownershipMetadata{}, false, fmt.Sprintf("ownership metadata read failed at %s: %v", path, err)
	}
	var payload ownershipMetadata
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ownershipMetadata{}, false, fmt.Sprintf("ownership metadata at %s is corrupt: %v; ignoring and starting fresh", path, err)
	}
	if payload.Owner != "deck-go" || payload.PID <= 0 {
		return ownershipMetadata{}, false, fmt.Sprintf("ownership metadata mismatch: owner=%q pid=%d (expected owner=deck-go pid>0)", payload.Owner, payload.PID)
	}
	if payload.BindHost != cfg.BindHost || payload.BindPort != cfg.BindPort {
		return ownershipMetadata{}, false, fmt.Sprintf("ownership metadata bind mismatch: %s:%d != %s:%d", payload.BindHost, payload.BindPort, cfg.BindHost, cfg.BindPort)
	}
	if payload.StateDir != cfg.Env["OPENCLAW_STATE_DIR"] {
		return ownershipMetadata{}, false, "ownership metadata state directory mismatch"
	}
	if payload.LaunchFingerprint != launchFingerprint(cfg) {
		return ownershipMetadata{}, false, "ownership metadata launch fingerprint mismatch (config or args changed since prior launch)"
	}
	if payload.TokenHash != tokenHash(cfg.GatewayToken) {
		return ownershipMetadata{}, false, "ownership metadata token hash mismatch"
	}
	if !managedProcessAlive(payload.PID) {
		return ownershipMetadata{}, false, fmt.Sprintf("ownership metadata pid %d no longer alive", payload.PID)
	}
	return payload, true, ""
}

func updateOwnershipMetadataStatus(settingsPath string, status Status, health Health) error {
	path := ownershipMetadataPath(settingsPath)
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	var payload ownershipMetadata
	if err := json.Unmarshal(raw, &payload); err != nil {
		return err
	}
	payload.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	payload.LastStatus = string(status)
	payload.LastHealth = string(health)
	return writeOwnershipMetadataPayload(path, payload)
}

func writeOwnershipMetadataPayload(path string, payload ownershipMetadata) error {
	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func ownershipMetadataPath(settingsPath string) string {
	return filepath.Join(filepath.Dir(settingsPath), "managed-gateway-state", "deck-go-owned-gateway.json")
}

func logOwnershipStatusUpdate(settingsPath string, status Status, health Health) {
	if err := updateOwnershipMetadataStatus(settingsPath, status, health); err != nil {
		log.Printf("supervisor: ownership metadata status update failed (status=%s health=%s): %v", status, health, err)
	}
}

func logOwnershipRemove(settingsPath string) {
	path := ownershipMetadataPath(settingsPath)
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Printf("supervisor: ownership metadata remove failed (path=%s): %v", path, err)
	}
}

func waitForManagedPIDExit(ctx context.Context, pid int, timeout time.Duration) error {
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()
	for {
		if !managedProcessAlive(pid) {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline.C:
			return errors.New("managed gateway process did not exit before timeout")
		case <-ticker.C:
		}
	}
}

func launchFingerprint(cfg config.ManagedGatewaySettings) string {
	payload := struct {
		Command    string   `json:"command"`
		Args       []string `json:"args"`
		WorkingDir string   `json:"workingDir"`
		BindHost   string   `json:"bindHost"`
		BindPort   int      `json:"bindPort"`
	}{
		Command:    cfg.Command,
		Args:       launchArgs(cfg),
		WorkingDir: cfg.WorkingDir,
		BindHost:   cfg.BindHost,
		BindPort:   cfg.BindPort,
	}
	raw, _ := json.Marshal(payload)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
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
	if err := interruptManagedProcess(cmd); err != nil {
		return cmd.Process.Kill()
	}
	return nil
}

func killProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	return killManagedProcessGroup(cmd)
}
