package bundled

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

type ExecCall struct {
	Command string
	Args    []string
	Env     []string
}

type ExecRunner interface {
	Run(ctx context.Context, call ExecCall) ([]byte, error)
}

type LifecycleProxy struct {
	ServiceName    string
	EntrypointPath string
	Exec           ExecRunner
	InheritEnv     []string
}

func (p *LifecycleProxy) Install(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "install")
}

func (p *LifecycleProxy) Start(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "start")
}

func (p *LifecycleProxy) Stop(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "stop")
}

func (p *LifecycleProxy) Restart(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "restart")
}

func (p *LifecycleProxy) Uninstall(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "uninstall")
}

func (p *LifecycleProxy) Reinstall(ctx context.Context) ([]byte, error) {
	if _, err := p.run(ctx, "uninstall"); err != nil {
		return nil, fmt.Errorf("reinstall: uninstall step failed: %w", err)
	}
	return p.run(ctx, "install")
}

func (p *LifecycleProxy) Status(ctx context.Context) ([]byte, error) {
	return p.run(ctx, "status", "--json")
}

func (p *LifecycleProxy) run(ctx context.Context, action string, extraArgs ...string) ([]byte, error) {
	runner := p.Exec
	if runner == nil {
		runner = OSExecRunner{}
	}
	args := []string{p.EntrypointPath, "gateway", action}
	args = append(args, extraArgs...)
	call := ExecCall{
		Command: "node",
		Args:    args,
		Env:     p.buildEnv(),
	}
	out, err := runner.Run(ctx, call)
	if err != nil {
		return out, fmt.Errorf("gateway %s failed: %w", action, err)
	}
	return out, nil
}

func (p *LifecycleProxy) buildEnv() []string {
	owned := map[string]struct{}{
		"OPENCLAW_LAUNCHD_LABEL":     {},
		"OPENCLAW_SYSTEMD_UNIT":      {},
		"OPENCLAW_WINDOWS_TASK_NAME": {},
	}
	env := make([]string, 0, len(p.InheritEnv)+len(owned))
	for _, entry := range p.InheritEnv {
		key := entry
		if eq := strings.IndexByte(entry, '='); eq >= 0 {
			key = entry[:eq]
		}
		if _, ok := owned[key]; ok {
			continue
		}
		env = append(env, entry)
	}
	env = append(env,
		"OPENCLAW_LAUNCHD_LABEL="+p.ServiceName,
		"OPENCLAW_SYSTEMD_UNIT="+p.ServiceName,
		"OPENCLAW_WINDOWS_TASK_NAME="+p.ServiceName,
	)
	return env
}

type OSExecRunner struct{}

func (OSExecRunner) Run(ctx context.Context, call ExecCall) ([]byte, error) {
	cmd := exec.CommandContext(ctx, call.Command, call.Args...)
	cmd.Env = call.Env
	out, err := cmd.CombinedOutput()
	if err != nil {
		return out, fmt.Errorf("%w: %s", err, strings.TrimSpace(string(out)))
	}
	return out, nil
}

type CLIServiceQuerier struct {
	Proxy *LifecycleProxy
}

func (q *CLIServiceQuerier) Query(ctx context.Context, _ string) (ServiceState, error) {
	if q == nil || q.Proxy == nil {
		return ServiceState{}, nil
	}
	out, err := q.Proxy.Status(ctx)
	if len(out) == 0 && err != nil {
		return ServiceState{}, err
	}
	var status struct {
		Service struct {
			Loaded  bool `json:"loaded"`
			Runtime *struct {
				Status string `json:"status"`
			} `json:"runtime"`
		} `json:"service"`
	}
	if parseErr := json.Unmarshal(out, &status); parseErr != nil {
		if err != nil {
			return ServiceState{}, err
		}
		return ServiceState{}, parseErr
	}
	return ServiceState{
		Registered: status.Service.Loaded,
		Active:     status.Service.Runtime != nil && status.Service.Runtime.Status == "running",
	}, nil
}
