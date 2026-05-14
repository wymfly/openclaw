package facade

import (
	"context"
	"errors"
	"fmt"
)

var (
	ErrUnsupported   = errors.New("runtime operation is unsupported in this mode")
	ErrNotConfigured = errors.New("runtime endpoint is not configured")
)

const (
	CodeEndpointNotMutable    = "endpoint_not_mutable"
	CodeGatewayNotConfigured  = "gateway_not_configured"
	CodeInvalidURL            = "invalid_url"
	CodeTokenRequired         = "token_required"
	CodeInvalidTLSVerify      = "invalid_tls_verify"
	CodeGatewayUnreachable    = "gateway_unreachable"
	CodeGatewayAuthFailed     = "gateway_auth_failed"
	CodeTLSVerificationFailed = "tls_verification_failed"
	CodeEndpointSwitching     = "endpoint_switching"
)

type CodedError struct {
	ErrorCode  string
	Message    string
	HTTPStatus int
}

func NewCodedError(code string, message string, httpStatus int) *CodedError {
	return &CodedError{ErrorCode: code, Message: message, HTTPStatus: httpStatus}
}

func (e *CodedError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("runtime error %s", e.ErrorCode)
}

func CodedErrorInfo(err error) (string, int, bool) {
	var coded *CodedError
	if !errors.As(err, &coded) || coded == nil {
		return "", 0, false
	}
	status := coded.HTTPStatus
	if status == 0 {
		status = 500
	}
	return coded.ErrorCode, status, true
}

const (
	StreamEventEndpointSwitched   = "endpoint_switched"
	StreamEventReconnectRequested = "reconnect_requested"
)

type Capabilities struct {
	Mode            string `json:"mode"`
	Configured      bool   `json:"configured"`
	EndpointMutable bool   `json:"endpointMutable"`
	SupervisorState bool   `json:"supervisorState"`
}

type RemoteEndpointInput struct {
	URL       string `json:"url"`
	Token     string `json:"token"`
	TLSVerify bool   `json:"tlsVerify"`
}

type EndpointView struct {
	URL             string `json:"url"`
	TokenConfigured bool   `json:"tokenConfigured"`
	TLSVerify       bool   `json:"tlsVerify"`
	Source          string `json:"source"`
}

type GatewayConnection struct {
	URL       string
	Token     string
	TLSVerify bool
}

type TestResult struct {
	OK             bool    `json:"ok"`
	LatencyMs      float64 `json:"latencyMs,omitempty"`
	GatewayVersion string  `json:"gatewayVersion,omitempty"`
	TLSVerified    bool    `json:"tlsVerified"`
	Error          string  `json:"error,omitempty"`
}

type StreamEvent struct {
	StreamID string
	Name     string
}

type RuntimeStatus struct {
	Mode            string  `json:"mode"`
	Configured      bool    `json:"configured,omitempty"`
	Status          string  `json:"status,omitempty"`
	Health          string  `json:"health,omitempty"`
	GatewayURL      string  `json:"gatewayUrl,omitempty"`
	PID             *int    `json:"pid,omitempty"`
	OwnershipState  string  `json:"ownershipState,omitempty"`
	RestartAttempts int     `json:"restartAttempts,omitempty"`
	LastConnectedAt *string `json:"lastConnectedAt,omitempty"`
	LastError       *string `json:"lastError,omitempty"`
	LatencyP50      *int    `json:"latencyP50,omitempty"`
	TLSVerified     *bool   `json:"tlsVerified,omitempty"`
	LifecycleState  string  `json:"lifecycleState,omitempty"`
	ServiceName     string  `json:"serviceName,omitempty"`
	EntrypointPath  string  `json:"entrypointPath,omitempty"`
}

type RuntimeFacade interface {
	Capabilities(context.Context) (Capabilities, error)
	Endpoint(context.Context) (EndpointView, error)
	UpdateRemoteEndpoint(context.Context, RemoteEndpointInput) (EndpointView, error)
	TestRemoteEndpoint(context.Context, *RemoteEndpointInput) (TestResult, error)
	RuntimeGatewayStatus(context.Context) (RuntimeStatus, error)
	Start(context.Context) (RuntimeStatus, error)
	Stop(context.Context) (RuntimeStatus, error)
	Restart(context.Context) (RuntimeStatus, error)
	Install(context.Context) (RuntimeStatus, error)
	Reinstall(context.Context) (RuntimeStatus, error)
	ReloadRuntime(context.Context) (RuntimeStatus, error)
}
