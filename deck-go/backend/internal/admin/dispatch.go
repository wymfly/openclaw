package admin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type Verb string

const (
	VerbReloadRuntime Verb = "reload-runtime"
	VerbStatus        Verb = "status"
)

var ErrUnknownVerb = errors.New("unknown admin verb")

type RuntimeFacade interface {
	Capabilities(context.Context) (facade.Capabilities, error)
	RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error)
	ReloadRuntime(context.Context) (facade.RuntimeStatus, error)
}

type Handler interface {
	Dispatch(context.Context, Verb) (json.RawMessage, error)
}

type RuntimeHandler struct {
	Runtime RuntimeFacade
}

type Status struct {
	Mode            string  `json:"mode"`
	Configured      bool    `json:"configured"`
	EndpointMutable bool    `json:"endpointMutable"`
	SupervisorState bool    `json:"supervisorState"`
	LastError       *string `json:"lastError,omitempty"`
	LastConnectedAt *string `json:"lastConnectedAt,omitempty"`
}

func (h RuntimeHandler) Dispatch(ctx context.Context, verb Verb) (json.RawMessage, error) {
	return Dispatch(ctx, h.Runtime, verb)
}

func Dispatch(ctx context.Context, runtime RuntimeFacade, verb Verb) (json.RawMessage, error) {
	if runtime == nil {
		return nil, errors.New("runtime facade is required")
	}
	switch verb {
	case VerbStatus:
		status, err := status(ctx, runtime)
		if err != nil {
			return nil, err
		}
		return json.Marshal(status)
	case VerbReloadRuntime:
		status, err := runtime.ReloadRuntime(ctx)
		if err != nil {
			return nil, err
		}
		return json.Marshal(status)
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnknownVerb, verb)
	}
}

func status(ctx context.Context, runtime RuntimeFacade) (Status, error) {
	caps, err := runtime.Capabilities(ctx)
	if err != nil {
		return Status{}, err
	}
	result := Status{
		Mode:            caps.Mode,
		Configured:      caps.Configured,
		EndpointMutable: caps.EndpointMutable,
		SupervisorState: caps.SupervisorState,
	}
	runtimeStatus, err := runtime.RuntimeGatewayStatus(ctx)
	if err != nil {
		if errors.Is(err, facade.ErrNotConfigured) {
			return result, nil
		}
		return Status{}, err
	}
	result.LastError = runtimeStatus.LastError
	result.LastConnectedAt = runtimeStatus.LastConnectedAt
	return result, nil
}
