package local

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

var (
	ErrEntrypointNotFound    = errors.New("entrypoint_not_found")
	ErrEntrypointOutsideRepo = errors.New("entrypoint_outside_repo")
)

type ResolveOptions struct {
	RepoRootEnv             string
	BFFBinaryDir            string
	InstallTimeAbsolutePath string
}

func ResolveEntrypoint(opts ResolveOptions) (string, error) {
	attempts := make([]string, 0, 3)

	if opts.RepoRootEnv != "" {
		candidate := filepath.Join(opts.RepoRootEnv, "dist", "entry.js")
		attempts = append(attempts, candidate)
		if ok, err := fileExists(candidate); err != nil {
			return "", err
		} else if ok {
			return verifyInsideRepo(candidate)
		}
	}

	if opts.BFFBinaryDir != "" {
		repoRoot := filepath.Clean(filepath.Join(opts.BFFBinaryDir, "..", "..", ".."))
		candidate := filepath.Join(repoRoot, "dist", "entry.js")
		attempts = append(attempts, candidate)
		if ok, err := fileExists(candidate); err != nil {
			return "", err
		} else if ok {
			return verifyInsideRepo(candidate)
		}
	}

	if opts.InstallTimeAbsolutePath != "" {
		attempts = append(attempts, opts.InstallTimeAbsolutePath)
		if ok, err := fileExists(opts.InstallTimeAbsolutePath); err != nil {
			return "", err
		} else if ok {
			return verifyInsideRepo(opts.InstallTimeAbsolutePath)
		}
	}

	return "", fmt.Errorf("%w: attempted=%v", ErrEntrypointNotFound, attempts)
}

func fileExists(path string) (bool, error) {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return !info.IsDir(), nil
}

func verifyInsideRepo(entrypointPath string) (string, error) {
	absEntrypoint, err := filepath.Abs(entrypointPath)
	if err != nil {
		return "", err
	}
	repoRoot := filepath.Clean(filepath.Join(filepath.Dir(absEntrypoint), ".."))
	pkgPath := filepath.Join(repoRoot, "package.json")
	data, err := os.ReadFile(pkgPath)
	if err != nil {
		return "", fmt.Errorf("%w: package.json missing at %s", ErrEntrypointOutsideRepo, pkgPath)
	}
	var pkg struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return "", fmt.Errorf("%w: invalid package.json at %s: %v", ErrEntrypointOutsideRepo, pkgPath, err)
	}
	if pkg.Name != "openclaw" {
		return "", fmt.Errorf("%w: package.json name=%q", ErrEntrypointOutsideRepo, pkg.Name)
	}
	return absEntrypoint, nil
}
