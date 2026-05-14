package bundled

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/shared"
)

type Dependencies struct {
	ResolveOpts        ResolveOptions
	EntrypointOverride string
	ServiceName        string
	Probe              *LifecycleProbe
	ProxyExec          ExecRunner
	InheritEnv         []string
}

type Facade struct {
	cfg                   envconf.RuntimeBundledConfig
	entrypointPath        string
	entrypointResolveErr  error
	serviceName           string
	probe                 *LifecycleProbe
	proxy                 *LifecycleProxy
	newClient             func(shared.Endpoint) *shared.Client
	lastResolvedRepoRoot  string
	lastEntrypointAttempt string
}

func New(cfg *envconf.RuntimeBundledConfig) (*Facade, error) {
	exe, _ := os.Executable()
	deps := Dependencies{
		ResolveOpts: ResolveOptions{
			RepoRootEnv:  os.Getenv("OPENCLAW_REPO_ROOT"),
			BFFBinaryDir: filepath.Dir(exe),
		},
		InheritEnv: os.Environ(),
	}
	return NewWithDependencies(cfg, deps)
}

func NewWithDependencies(cfg *envconf.RuntimeBundledConfig, deps Dependencies) (*Facade, error) {
	if cfg == nil {
		return nil, errors.New("bundled runtime config is required")
	}
	entrypointPath := deps.EntrypointOverride
	var resolveErr error
	if entrypointPath == "" {
		resolved, err := ResolveEntrypoint(deps.ResolveOpts)
		if err != nil {
			if !errors.Is(err, ErrEntrypointNotFound) {
				return nil, err
			}
			resolveErr = err
			entrypointPath = bestEntrypointAttempt(deps.ResolveOpts)
		} else {
			entrypointPath = resolved
		}
	}
	repoRoot := repoRootForServiceName(deps.ResolveOpts, entrypointPath)
	serviceName := deps.ServiceName
	if serviceName == "" {
		serviceName = DeriveServiceName(repoRoot)
	}
	runner := deps.ProxyExec
	if runner == nil {
		runner = OSExecRunner{}
	}
	proxy := &LifecycleProxy{
		ServiceName:    serviceName,
		EntrypointPath: entrypointPath,
		Exec:           runner,
		InheritEnv:     deps.InheritEnv,
	}
	probe := deps.Probe
	if probe == nil {
		probe = &LifecycleProbe{
			Service: &CLIServiceQuerier{Proxy: proxy},
			Health: &GatewayHealthClient{
				URL:   bundledEndpointURL(*cfg),
				Token: cfg.Token,
			},
		}
	}
	return &Facade{
		cfg:                   *cfg,
		entrypointPath:        entrypointPath,
		entrypointResolveErr:  resolveErr,
		serviceName:           serviceName,
		probe:                 probe,
		proxy:                 proxy,
		newClient:             shared.NewClient,
		lastResolvedRepoRoot:  repoRoot,
		lastEntrypointAttempt: entrypointPath,
	}, nil
}

func (f *Facade) Capabilities(ctx context.Context) (facade.Capabilities, error) {
	status, err := f.RuntimeGatewayStatus(ctx)
	if err != nil {
		return facade.Capabilities{}, err
	}
	return facade.Capabilities{
		Mode:            string(envconf.ModeBundled),
		Configured:      status.LifecycleState == string(StateRunning),
		EndpointMutable: false,
		SupervisorState: true,
	}, nil
}

func (f *Facade) Endpoint(context.Context) (facade.EndpointView, error) {
	return facade.EndpointView{
		URL:             bundledEndpointURL(f.cfg),
		TokenConfigured: strings.TrimSpace(f.cfg.Token) != "",
		TLSVerify:       false,
		Source:          "env",
	}, nil
}

func (f *Facade) GatewayConnection(context.Context) (facade.GatewayConnection, error) {
	return facade.GatewayConnection{
		URL:       bundledEndpointURL(f.cfg),
		Token:     f.cfg.Token,
		TLSVerify: false,
	}, nil
}

func (f *Facade) UpdateRemoteEndpoint(context.Context, facade.RemoteEndpointInput) (facade.EndpointView, error) {
	return facade.EndpointView{}, facade.ErrUnsupported
}

func (f *Facade) TestRemoteEndpoint(context.Context, *facade.RemoteEndpointInput) (facade.TestResult, error) {
	return facade.TestResult{}, facade.ErrUnsupported
}

func (f *Facade) RuntimeGatewayStatus(ctx context.Context) (facade.RuntimeStatus, error) {
	entrypointExists := false
	if f.entrypointResolveErr == nil && strings.TrimSpace(f.entrypointPath) != "" {
		if info, err := os.Stat(f.entrypointPath); err == nil && !info.IsDir() {
			entrypointExists = true
		}
	}
	res, err := f.probe.Probe(ctx, ProbeInputs{
		ServiceName:      f.serviceName,
		EntrypointPath:   f.entrypointPath,
		EntrypointExists: entrypointExists,
	})
	if err != nil {
		return facade.RuntimeStatus{}, err
	}
	status := facade.RuntimeStatus{
		Mode:           string(envconf.ModeBundled),
		Configured:     res.LifecycleState == StateRunning,
		Status:         runtimeStatusFromLifecycle(res.LifecycleState),
		Health:         runtimeHealthFromLifecycle(res.LifecycleState),
		GatewayURL:     bundledEndpointURL(f.cfg),
		LifecycleState: string(res.LifecycleState),
		ServiceName:    f.serviceName,
		EntrypointPath: f.entrypointPath,
		AutoStart:      f.cfg.AutoStart,
	}
	if res.LastError != "" {
		lastError := res.LastError
		status.LastError = &lastError
	}
	return status, nil
}

func (f *Facade) Start(ctx context.Context) (facade.RuntimeStatus, error) {
	return f.runLifecycleAction(ctx, f.proxy.Start)
}

func (f *Facade) Stop(ctx context.Context) (facade.RuntimeStatus, error) {
	return f.runLifecycleAction(ctx, f.proxy.Stop)
}

func (f *Facade) Restart(ctx context.Context) (facade.RuntimeStatus, error) {
	return f.runLifecycleAction(ctx, f.proxy.Restart)
}

func (f *Facade) Install(ctx context.Context) (facade.RuntimeStatus, error) {
	return f.runLifecycleAction(ctx, f.proxy.Install)
}

func (f *Facade) Reinstall(ctx context.Context) (facade.RuntimeStatus, error) {
	return f.runLifecycleAction(ctx, f.proxy.Reinstall)
}

func (f *Facade) ReloadRuntime(ctx context.Context) (facade.RuntimeStatus, error) {
	return f.Restart(ctx)
}

func (f *Facade) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	return f.client().Request(ctx, method, params)
}

func (f *Facade) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	paramsMap, err := requestParamsToMap(params)
	if err != nil {
		return nil, err
	}
	return f.Request(ctx, method, paramsMap)
}

func (f *Facade) runLifecycleAction(
	ctx context.Context,
	action func(context.Context) ([]byte, error),
) (facade.RuntimeStatus, error) {
	_, actionErr := action(ctx)
	status, statusErr := f.RuntimeGatewayStatus(ctx)
	if actionErr != nil {
		return status, actionErr
	}
	return status, statusErr
}

func (f *Facade) client() *shared.Client {
	return f.newClient(shared.Endpoint{
		URL:       bundledEndpointURL(f.cfg),
		Token:     f.cfg.Token,
		TLSVerify: false,
	})
}

func bundledEndpointURL(cfg envconf.RuntimeBundledConfig) string {
	host := strings.TrimSpace(cfg.BindHost)
	if host == "" {
		host = "127.0.0.1"
	}
	port := cfg.BindPort
	if port <= 0 {
		port = 18789
	}
	return "ws://" + host + ":" + strconv.Itoa(port)
}

func requestParamsToMap(params any) (map[string]any, error) {
	if params == nil {
		return map[string]any{}, nil
	}
	if paramsMap, ok := params.(map[string]any); ok {
		if paramsMap == nil {
			return map[string]any{}, nil
		}
		return paramsMap, nil
	}
	raw, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	if string(raw) == "null" {
		return map[string]any{}, nil
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	if out == nil {
		return map[string]any{}, nil
	}
	return out, nil
}

func runtimeStatusFromLifecycle(state LifecycleState) string {
	switch state {
	case StateRunning:
		return "running"
	case StateUnhealthy:
		return "failed"
	default:
		return "stopped"
	}
}

func runtimeHealthFromLifecycle(state LifecycleState) string {
	switch state {
	case StateRunning:
		return "healthy"
	case StateUnhealthy:
		return "unhealthy"
	default:
		return "unknown"
	}
}

func bestEntrypointAttempt(opts ResolveOptions) string {
	if strings.TrimSpace(opts.RepoRootEnv) != "" {
		return filepath.Join(opts.RepoRootEnv, "dist", "entry.js")
	}
	if strings.TrimSpace(opts.BFFBinaryDir) != "" {
		return filepath.Join(filepath.Clean(filepath.Join(opts.BFFBinaryDir, "..", "..", "..")), "dist", "entry.js")
	}
	if strings.TrimSpace(opts.InstallTimeAbsolutePath) != "" {
		return opts.InstallTimeAbsolutePath
	}
	if root, ok := findOpenClawRepoRootFromCWD(); ok {
		return filepath.Join(root, "dist", "entry.js")
	}
	return filepath.Join("dist", "entry.js")
}

func repoRootForServiceName(opts ResolveOptions, entrypointPath string) string {
	if strings.TrimSpace(opts.RepoRootEnv) != "" {
		if abs, err := filepath.Abs(opts.RepoRootEnv); err == nil {
			return abs
		}
		return opts.RepoRootEnv
	}
	if strings.TrimSpace(entrypointPath) != "" {
		if abs, err := filepath.Abs(filepath.Join(filepath.Dir(entrypointPath), "..")); err == nil {
			return abs
		}
	}
	if root, ok := findOpenClawRepoRootFromCWD(); ok {
		return root
	}
	if cwd, err := os.Getwd(); err == nil {
		return cwd
	}
	return "."
}

func findOpenClawRepoRootFromCWD() (string, bool) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", false
	}
	dir := cwd
	for {
		pkgPath := filepath.Join(dir, "package.json")
		data, err := os.ReadFile(pkgPath)
		if err == nil {
			var pkg struct {
				Name string `json:"name"`
			}
			if json.Unmarshal(data, &pkg) == nil && pkg.Name == "openclaw" {
				return dir, true
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}

var _ facade.RuntimeFacade = (*Facade)(nil)

func init() {
	facade.RegisterBundledFactory(func(cfg *envconf.RuntimeBundledConfig) (facade.RuntimeFacade, error) {
		return New(cfg)
	})
}
