package runtimecontrol

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

type preflightFunc func(context.Context, config.ManagedGatewaySettings) error
type commandRunner func(context.Context, string, string, []string, []string) error

var runManagedCommand commandRunner = defaultCommandRunner

func defaultPreflight(ctx context.Context, cfg config.ManagedGatewaySettings) error {
	requiresPrepared := requiresPreparedRuntime(cfg)
	if requiresPrepared && launchesGatewayCommand(cfg) {
		if err := ensureManagedGatewayPortAvailable(cfg); err != nil {
			return err
		}
	}
	if !requiresPrepared {
		return nil
	}
	if err := validatePreparedRuntimeRoot(cfg.WorkingDir); err != nil {
		return err
	}
	ready, err := preparedRuntimeReady(cfg.WorkingDir)
	if err != nil {
		return err
	}
	if ready {
		return nil
	}
	env := append(os.Environ(), managedEnv(cfg)...)
	for _, step := range []struct {
		name string
		args []string
	}{
		{name: "pnpm", args: []string{"build"}},
		{name: "pnpm", args: []string{"ui:build"}},
		{name: "node", args: []string{"scripts/build-stamp.mjs"}},
	} {
		if err := runManagedCommand(ctx, cfg.WorkingDir, step.name, step.args, env); err != nil {
			return err
		}
	}
	ready, err = preparedRuntimeReady(cfg.WorkingDir)
	if err != nil {
		return err
	}
	if !ready {
		return errors.New("prepared runtime contract completed but required runtime artifacts are still missing")
	}
	return nil
}

func launchesGatewayCommand(cfg config.ManagedGatewaySettings) bool {
	for idx := 0; idx+1 < len(cfg.Args); idx++ {
		if cfg.Args[idx] == "gateway" && cfg.Args[idx+1] == "run" {
			return true
		}
	}
	return false
}

func ensureManagedGatewayPortAvailable(cfg config.ManagedGatewaySettings) error {
	if cfg.BindPort <= 0 {
		return nil
	}
	host := cfg.BindHost
	if strings.TrimSpace(host) == "" || host == "loopback" {
		host = "127.0.0.1"
	}
	addr := net.JoinHostPort(host, strconv.Itoa(cfg.BindPort))
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("managed gateway port %s is already in use; stop the other listener or configure another port: %w", addr, err)
	}
	return listener.Close()
}

func requiresPreparedRuntime(cfg config.ManagedGatewaySettings) bool {
	if strings.TrimSpace(cfg.WorkingDir) == "" {
		return false
	}
	commandBase := strings.TrimSpace(filepath.Base(cfg.Command))
	commandBase = strings.TrimSuffix(commandBase, filepath.Ext(commandBase))
	if commandBase != "node" && commandBase != "bun" {
		return false
	}
	if len(cfg.Args) == 0 {
		return false
	}
	entry := strings.TrimSpace(cfg.Args[0])
	return entry == "dist/entry.js" || entry == "dist/index.js" || entry == "openclaw.mjs"
}

func validatePreparedRuntimeRoot(root string) error {
	if strings.TrimSpace(root) == "" {
		return errors.New("managed gateway workingDir is required for prepared-runtime launch")
	}
	required := []string{
		filepath.Join(root, "package.json"),
		filepath.Join(root, "openclaw.mjs"),
	}
	for _, candidate := range required {
		if _, err := os.Stat(candidate); err != nil {
			return errors.New("managed gateway workingDir does not look like an OpenClaw repo/package root")
		}
	}
	return nil
}

func preparedRuntimeReady(root string) (bool, error) {
	entry := filepath.Join(root, "dist", "entry.js")
	buildStamp := filepath.Join(root, "dist", ".buildstamp")
	controlUI := filepath.Join(root, "dist", "control-ui", "index.html")
	for _, candidate := range []string{entry, buildStamp, controlUI} {
		if _, err := os.Stat(candidate); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return false, nil
			}
			return false, err
		}
	}
	stampRaw, err := os.ReadFile(buildStamp)
	if err != nil {
		return false, err
	}
	var stamp struct {
		Head string `json:"head"`
	}
	if err := json.Unmarshal(stampRaw, &stamp); err != nil {
		return false, err
	}
	if strings.TrimSpace(stamp.Head) == "" {
		return false, nil
	}
	return true, nil
}

func defaultCommandRunner(ctx context.Context, workingDir string, name string, args []string, env []string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = workingDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = env
	return cmd.Run()
}
