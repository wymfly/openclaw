package facade_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRuntimePackageImportBoundaries(t *testing.T) {
	runtimeRoot := filepath.Clean("..")
	assertNoImport(t, filepath.Join(runtimeRoot, "bundled"), "/internal/runtime/remote")
	assertNoImport(t, filepath.Join(runtimeRoot, "remote"), "/internal/runtime/bundled")
	assertNoImport(t, filepath.Join(runtimeRoot, "shared"), "/internal/runtime/bundled")
	assertNoImport(t, filepath.Join(runtimeRoot, "shared"), "/internal/runtime/remote")
	assertNoImport(t, filepath.Join(runtimeRoot, "shared"), "/internal/runtime/facade")
}

func assertNoImport(t *testing.T, root string, forbidden string) {
	t.Helper()
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("%s imports forbidden path fragment %s", path, forbidden)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk %s: %v", root, err)
	}
}
