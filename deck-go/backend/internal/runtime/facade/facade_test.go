package facade

import (
	"errors"
	"testing"
)

func TestSentinelErrorsAreStable(t *testing.T) {
	if !errors.Is(ErrUnsupported, ErrUnsupported) {
		t.Fatal("ErrUnsupported must be usable with errors.Is")
	}
	if !errors.Is(ErrNotConfigured, ErrNotConfigured) {
		t.Fatal("ErrNotConfigured must be usable with errors.Is")
	}
}

func TestCodedErrorsExposeStableCodes(t *testing.T) {
	err := NewCodedError(CodeInvalidURL, "invalid url", 400)
	code, status, ok := CodedErrorInfo(err)
	if !ok {
		t.Fatalf("CodedErrorInfo() did not recognize %T", err)
	}
	if code != CodeInvalidURL || status != 400 {
		t.Fatalf("code/status = %q/%d", code, status)
	}
}

func TestCapabilitiesShape(t *testing.T) {
	caps := Capabilities{
		Mode:            "remote",
		Configured:      false,
		EndpointMutable: true,
		SupervisorState: false,
	}
	if caps.Mode != "remote" || caps.Configured || !caps.EndpointMutable || caps.SupervisorState {
		t.Fatalf("unexpected capabilities: %#v", caps)
	}
}
