package bundled

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestBundledPackage_DoesNotUseTimeTickerForPeriodicProbes encodes the Stage 1
// task 2.1.6 / design-D7 discipline: probe is event-driven (boot, per-request,
// the /api/runtime/gateway/refresh route, and after every lifecycle action),
// never on a periodic timer. This regression guard forbids `time.NewTicker` and
// `time.Tick(` in any non-test source file of this package.
//
// If a future change introduces a background poll, the new design discussion
// must update D7 first; this test SHALL stay green.
func TestBundledPackage_DoesNotUseTimeTickerForPeriodicProbes(t *testing.T) {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("failed to resolve current test file path")
	}
	dir := filepath.Dir(currentFile)
	files, err := filepath.Glob(filepath.Join(dir, "*.go"))
	if err != nil {
		t.Fatalf("glob %s: %v", dir, err)
	}
	forbidden := []string{"time.NewTicker", "time.Tick("}
	for _, file := range files {
		if strings.HasSuffix(file, "_test.go") {
			continue
		}
		content, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		source := string(content)
		for _, pattern := range forbidden {
			if strings.Contains(source, pattern) {
				t.Fatalf(
					"%s uses %q: Stage 1 D7 probe-trigger discipline forbids periodic-timer probes",
					file,
					pattern,
				)
			}
		}
	}
}
