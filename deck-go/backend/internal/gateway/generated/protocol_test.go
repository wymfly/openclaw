package generated

import "testing"

func TestAllowlistContainsScopedUntypedMethods(t *testing.T) {
	for _, method := range []string{"plugin.approval.list", "plugin.approval.waitDecision"} {
		if _, ok := AllowlistMethodNames[method]; !ok {
			t.Fatalf("expected allowlist to contain %s", method)
		}
		if _, ok := TypedMethodNames[method]; ok {
			t.Fatalf("expected typed methods to exclude untyped scoped method %s", method)
		}
	}
}

func TestTypedMethodsAreAllowlistSubset(t *testing.T) {
	for method := range TypedMethodNames {
		if _, ok := AllowlistMethodNames[method]; !ok {
			t.Fatalf("typed method %s is missing from allowlist", method)
		}
	}
	if len(TypedMethodNames) >= len(AllowlistMethodNames) {
		t.Fatalf("expected typed methods to be a strict subset of allowlist")
	}
}
