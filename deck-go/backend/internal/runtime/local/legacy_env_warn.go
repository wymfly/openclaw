package local

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
)

var legacyEnvWarnOnce sync.Once

func WarnLegacyEnvVarsOnce(out io.Writer, env map[string]string, extraKeys []string) {
	keys := collectLegacyBundledKeys(env, extraKeys)
	if len(keys) == 0 {
		return
	}
	if out == nil {
		out = io.Discard
	}
	legacyEnvWarnOnce.Do(func() {
		fmt.Fprintf(out, "WARNING deprecated RUNTIME_BUNDLED_* env vars are ignored in local runtime mode: %s\n", strings.Join(keys, ", "))
	})
}

func collectLegacyBundledKeys(env map[string]string, extraKeys []string) []string {
	seen := map[string]struct{}{}
	for key := range env {
		if strings.HasPrefix(key, "RUNTIME_BUNDLED_") {
			seen[key] = struct{}{}
		}
	}
	for _, key := range extraKeys {
		key = strings.TrimSpace(key)
		if strings.HasPrefix(key, "RUNTIME_BUNDLED_") {
			seen[key] = struct{}{}
		}
	}
	keys := make([]string, 0, len(seen))
	for key := range seen {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
