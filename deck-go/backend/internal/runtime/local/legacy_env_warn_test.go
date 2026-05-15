package local

import (
	"bytes"
	"strings"
	"sync"
	"testing"
)

func TestWarnLegacyEnvVarsOnceFiresOnceWhenLegacyKeySet(t *testing.T) {
	resetLegacyEnvWarnState()
	buf := &bytes.Buffer{}
	env := map[string]string{
		"RUNTIME_BUNDLED_TOKEN":     "ignored",
		"RUNTIME_BUNDLED_BIND_HOST": "127.0.0.1",
	}

	WarnLegacyEnvVarsOnce(buf, env, nil)
	WarnLegacyEnvVarsOnce(buf, env, nil)
	WarnLegacyEnvVarsOnce(buf, env, nil)

	out := buf.String()
	if strings.Count(out, "RUNTIME_BUNDLED_TOKEN") != 1 {
		t.Fatalf("expected one RUNTIME_BUNDLED_TOKEN mention, got %q", out)
	}
	if strings.Count(out, "RUNTIME_BUNDLED_BIND_HOST") != 1 {
		t.Fatalf("expected one RUNTIME_BUNDLED_BIND_HOST mention, got %q", out)
	}
	if !strings.Contains(out, "deprecated") || !strings.Contains(out, "ignored") {
		t.Fatalf("warning should say deprecated and ignored, got %q", out)
	}
}

func TestWarnLegacyEnvVarsOnceDoesNotFireWithoutLegacyKey(t *testing.T) {
	resetLegacyEnvWarnState()
	buf := &bytes.Buffer{}
	WarnLegacyEnvVarsOnce(buf, map[string]string{"RUNTIME_MODE": "local"}, nil)
	if buf.Len() != 0 {
		t.Fatalf("expected no warning, got %q", buf.String())
	}
}

func TestWarnLegacyEnvVarsOnceMergesDotenvKeys(t *testing.T) {
	resetLegacyEnvWarnState()
	buf := &bytes.Buffer{}
	WarnLegacyEnvVarsOnce(buf, nil, []string{"RUNTIME_BUNDLED_TOKEN", "RUNTIME_BUNDLED_BIND_PORT"})
	out := buf.String()
	if !strings.Contains(out, "RUNTIME_BUNDLED_TOKEN") || !strings.Contains(out, "RUNTIME_BUNDLED_BIND_PORT") {
		t.Fatalf("dotenv-only legacy keys missing from warning: %q", out)
	}
}

func TestWarnLegacyEnvVarsOnceDedupesKeys(t *testing.T) {
	resetLegacyEnvWarnState()
	buf := &bytes.Buffer{}
	WarnLegacyEnvVarsOnce(
		buf,
		map[string]string{"RUNTIME_BUNDLED_TOKEN": "ignored"},
		[]string{"RUNTIME_BUNDLED_TOKEN"},
	)
	if strings.Count(buf.String(), "RUNTIME_BUNDLED_TOKEN") != 1 {
		t.Fatalf("expected one de-duplicated key mention, got %q", buf.String())
	}
}

func TestWarnLegacyEnvVarsOnceRaceSafe(t *testing.T) {
	resetLegacyEnvWarnState()
	buf := &threadSafeBuffer{}
	env := map[string]string{"RUNTIME_BUNDLED_COMMAND": "node"}
	var wg sync.WaitGroup
	for i := 0; i < 64; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			WarnLegacyEnvVarsOnce(buf, env, nil)
		}()
	}
	wg.Wait()
	if strings.Count(buf.String(), "RUNTIME_BUNDLED_COMMAND") != 1 {
		t.Fatalf("expected one warning under concurrent callers, got %q", buf.String())
	}
}

type threadSafeBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *threadSafeBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *threadSafeBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func resetLegacyEnvWarnState() {
	legacyEnvWarnOnce = sync.Once{}
}
