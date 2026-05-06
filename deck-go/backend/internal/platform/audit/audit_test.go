package audit

import "testing"

func TestLogRetentionKeepsNewestEntries(t *testing.T) {
	log := NewLog(2)
	log.Append(Entry{RequestID: "req-1", Method: "POST", Path: "/api/one"})
	log.Append(Entry{RequestID: "req-2", Method: "POST", Path: "/api/two"})
	log.Append(Entry{RequestID: "req-3", Method: "POST", Path: "/api/three"})

	entries := log.Recent(10)
	if len(entries) != 2 {
		t.Fatalf("expected 2 retained entries, got %d", len(entries))
	}
	if entries[0].RequestID != "req-3" || entries[1].RequestID != "req-2" {
		t.Fatalf("expected newest entries first, got %#v", entries)
	}
	retention := log.Retention()
	if retention.Mode != "process-memory" || retention.MaxEntries != 2 {
		t.Fatalf("unexpected retention: %#v", retention)
	}
}

func TestMutationClassification(t *testing.T) {
	for _, method := range []string{"POST", "PUT", "PATCH", "DELETE"} {
		if !IsMutation(method) {
			t.Fatalf("%s should be classified as mutation", method)
		}
	}
	if IsMutation("GET") {
		t.Fatal("GET should not be classified as mutation")
	}
}
