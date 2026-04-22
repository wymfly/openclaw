package coerce

import "testing"

func TestScalarHelpers(t *testing.T) {
	if String("x", "") != "x" || String(1, "fallback") != "fallback" {
		t.Fatal("unexpected String behavior")
	}
	if FirstString("", "x", "y") != "x" {
		t.Fatal("unexpected FirstString behavior")
	}
	if Number(2) != 2 || Number(int64(3)) != 3 || Number("x") != 0 {
		t.Fatal("unexpected Number behavior")
	}
	if FirstNumber(0, 4, 5) != 4 {
		t.Fatal("unexpected FirstNumber behavior")
	}
	if !Bool(true) || Bool("x") {
		t.Fatal("unexpected Bool behavior")
	}
	record := Map(map[string]any{"ok": true})
	if !record["ok"].(bool) {
		t.Fatal("unexpected Map behavior")
	}
}
