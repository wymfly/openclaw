package envconf

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/security/privatefile"
)

type RuntimeMode string

const (
	ModeBundled RuntimeMode = "bundled"
	ModeRemote  RuntimeMode = "remote"
)

type RuntimeBundledConfig struct {
	Command    string
	Args       []string
	WorkingDir string
	BindHost   string
	BindPort   int
	Token      string
	AutoStart  bool
	Env        map[string]string
}

type RuntimeRemoteDefaults struct {
	URL       string
	Token     string
	TLSVerify bool
}

type Loaded struct {
	Mode    RuntimeMode
	Bundled RuntimeBundledConfig
	Remote  RuntimeRemoteDefaults
}

type Options struct {
	Environ    []string
	DotenvFile string
	Logf       func(string, ...any)
}

type UsageError struct {
	Err error
}

func (e *UsageError) Error() string {
	if e == nil || e.Err == nil {
		return ""
	}
	return e.Err.Error()
}

func (e *UsageError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func ExitCode(err error) int {
	var usage *UsageError
	if err != nil && errors.As(err, &usage) {
		return 64
	}
	return 1
}

func Load(opts Options) (Loaded, error) {
	env := envMap(opts.Environ)
	if opts.Environ == nil {
		env = envMap(os.Environ())
	}
	dotenvPath := strings.TrimSpace(opts.DotenvFile)
	if dotenvPath == "" {
		dotenvPath = strings.TrimSpace(env["DECK_DOTENV_FILE"])
	}
	if dotenvPath != "" {
		fileEnv, err := readDotenvFile(dotenvPath)
		if err != nil {
			return Loaded{}, err
		}
		for key, value := range fileEnv {
			if _, exists := env[key]; exists {
				if opts.Logf != nil {
					opts.Logf("INFO process env overrides dotenv value for %s", key)
				}
			} else {
				env[key] = value
			}
		}
	}

	mode := RuntimeMode(strings.TrimSpace(env["RUNTIME_MODE"]))
	switch mode {
	case "":
		return Loaded{}, usageErrorf("RUNTIME_MODE is required; expected bundled or remote; see deck-go/.env.bundled.example or deck-go/.env.remote.example")
	case ModeBundled:
		bundled, err := loadBundled(env)
		if err != nil {
			return Loaded{}, err
		}
		return Loaded{Mode: mode, Bundled: bundled, Remote: loadRemoteDefaults(env)}, nil
	case ModeRemote:
		remote := loadRemoteDefaults(env)
		if err := validateRemoteURL(remote.URL); err != nil {
			return Loaded{}, err
		}
		return Loaded{Mode: mode, Remote: remote}, nil
	default:
		return Loaded{}, usageErrorf("RUNTIME_MODE must be one of %q or %q, got %q", ModeBundled, ModeRemote, mode)
	}
}

func loadBundled(env map[string]string) (RuntimeBundledConfig, error) {
	command := strings.TrimSpace(env["RUNTIME_BUNDLED_COMMAND"])
	if command == "" {
		return RuntimeBundledConfig{}, usageErrorf("RUNTIME_BUNDLED_COMMAND is required when RUNTIME_MODE=bundled")
	}
	bindPort := 0
	if raw := strings.TrimSpace(env["RUNTIME_BUNDLED_BIND_PORT"]); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			return RuntimeBundledConfig{}, usageErrorf("RUNTIME_BUNDLED_BIND_PORT must be a positive integer, got %q", raw)
		}
		bindPort = parsed
	}
	autoStart := true
	if raw := strings.TrimSpace(env["RUNTIME_BUNDLED_AUTO_START"]); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			return RuntimeBundledConfig{}, usageErrorf("RUNTIME_BUNDLED_AUTO_START must be boolean: %w", err)
		}
		autoStart = parsed
	}
	forwarded, err := loadBundledEnv(env)
	if err != nil {
		return RuntimeBundledConfig{}, err
	}
	return RuntimeBundledConfig{
		Command:    command,
		Args:       strings.Fields(env["RUNTIME_BUNDLED_ARGS"]),
		WorkingDir: strings.TrimSpace(env["RUNTIME_BUNDLED_WORKDIR"]),
		BindHost:   strings.TrimSpace(env["RUNTIME_BUNDLED_BIND_HOST"]),
		BindPort:   bindPort,
		Token:      env["RUNTIME_BUNDLED_TOKEN"],
		AutoStart:  autoStart,
		Env:        forwarded,
	}, nil
}

func loadRemoteDefaults(env map[string]string) RuntimeRemoteDefaults {
	tlsVerify := true
	if raw := strings.TrimSpace(env["RUNTIME_REMOTE_TLS_VERIFY"]); raw != "" {
		if parsed, err := strconv.ParseBool(raw); err == nil {
			tlsVerify = parsed
		}
	}
	return RuntimeRemoteDefaults{
		URL:       strings.TrimSpace(env["RUNTIME_REMOTE_URL"]),
		Token:     env["RUNTIME_REMOTE_TOKEN"],
		TLSVerify: tlsVerify,
	}
}

func validateRemoteURL(raw string) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return usageErrorf("RUNTIME_REMOTE_URL must be a valid http or https URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return usageErrorf("RUNTIME_REMOTE_URL must use http or https, got %q", parsed.Scheme)
	}
	return nil
}

func loadBundledEnv(env map[string]string) (map[string]string, error) {
	extraDeny := map[string]struct{}{}
	for _, name := range strings.Split(env["RUNTIME_BUNDLED_ENV_DENY"], ",") {
		name = strings.ToUpper(strings.TrimSpace(name))
		if name != "" {
			extraDeny[name] = struct{}{}
		}
	}
	forwarded := map[string]string{}
	for key, value := range env {
		if !strings.HasPrefix(key, "RUNTIME_BUNDLED_ENV_") {
			continue
		}
		name := strings.TrimPrefix(key, "RUNTIME_BUNDLED_ENV_")
		if name == "DENY" {
			continue
		}
		if deniedBundledEnvName(name, extraDeny) {
			return nil, usageErrorf("RUNTIME_BUNDLED_ENV_%s is denied for Gateway pass-through env", name)
		}
		forwarded[name] = value
	}
	return forwarded, nil
}

func deniedBundledEnvName(name string, extra map[string]struct{}) bool {
	upper := strings.ToUpper(strings.TrimSpace(name))
	if _, denied := extra[upper]; denied {
		return true
	}
	switch upper {
	case "LD_PRELOAD", "LD_LIBRARY_PATH", "LD_AUDIT", "LD_BIND_NOW", "PATH":
		return true
	}
	return strings.HasPrefix(upper, "DYLD_")
}

func envMap(environ []string) map[string]string {
	result := map[string]string{}
	for _, entry := range environ {
		key, value, ok := strings.Cut(entry, "=")
		if !ok || key == "" {
			continue
		}
		result[key] = value
	}
	return result
}

func readDotenvFile(path string) (map[string]string, error) {
	if err := checkPrivateFileMode(path); err != nil {
		return nil, usageError(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, usageError(err)
	}
	result := map[string]string{}
	for idx, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return nil, usageErrorf("%s:%d: expected KEY=VALUE", path, idx+1)
		}
		key = strings.TrimSpace(key)
		if key == "" {
			return nil, usageErrorf("%s:%d: empty key", path, idx+1)
		}
		result[key] = unquoteDotenvValue(strings.TrimSpace(value))
	}
	return result, nil
}

func usageError(err error) error {
	if err == nil {
		return nil
	}
	var usage *UsageError
	if errors.As(err, &usage) {
		return err
	}
	return &UsageError{Err: err}
}

func usageErrorf(format string, args ...any) error {
	return &UsageError{Err: fmt.Errorf(format, args...)}
}

func checkPrivateFileMode(path string) error {
	return privatefile.CheckExisting(path)
}

func unquoteDotenvValue(value string) string {
	if len(value) < 2 {
		return value
	}
	if (value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'') {
		return value[1 : len(value)-1]
	}
	return value
}
