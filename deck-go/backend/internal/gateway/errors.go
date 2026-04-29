package gateway

import (
	"errors"
	"fmt"
)

type ErrCode struct {
	Code    string
	Message string
	Details map[string]any
}

type errScopeDeniedType struct{}

func (errScopeDeniedType) Error() string {
	return "scope_denied"
}

func (errScopeDeniedType) Is(target error) bool {
	var targetCode *ErrCode
	if errors.As(target, &targetCode) {
		return targetCode.Code == "scope_denied"
	}
	_, ok := target.(errScopeDeniedType)
	return ok
}

// ErrScopeDenied is the sentinel for envelope errors with code "scope_denied".
// It is a value sentinel so callers cannot mutate global error state.
var ErrScopeDenied error = errScopeDeniedType{}

func (e *ErrCode) Error() string {
	if e == nil {
		return ""
	}
	if e.Code == "" {
		return e.Message
	}
	if e.Message == "" {
		return e.Code
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *ErrCode) Is(target error) bool {
	if _, ok := target.(errScopeDeniedType); ok && e != nil {
		return e.Code == "scope_denied"
	}
	targetCode, ok := target.(*ErrCode)
	if !ok || e == nil || targetCode.Code == "" {
		return false
	}
	return e.Code == targetCode.Code
}

func FromEnvelope(envelope *responseError) error {
	if envelope == nil {
		return nil
	}
	return &ErrCode{
		Code:    envelope.Code,
		Message: envelope.Message,
		Details: envelope.Details,
	}
}
