package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

func registerRuntimeRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	managed openclawrt.ManagedRuntimeSurface,
	runtimeFacade facade.RuntimeFacade,
) {
	if runtimeFacade != nil {
		mux.MethodFunc("GET", "/runtime/capabilities", func(w http.ResponseWriter, r *http.Request) {
			caps, err := runtimeFacade.Capabilities(r.Context())
			if err != nil {
				writeRuntimeError(w, http.StatusInternalServerError, "runtime_capabilities_failed", err.Error())
				return
			}
			writeJSON(w, http.StatusOK, caps)
		})

		mux.MethodFunc("GET", "/runtime/endpoint", func(w http.ResponseWriter, r *http.Request) {
			payload, err := runtimeFacade.Endpoint(r.Context())
			if err != nil {
				writeRuntimeFacadeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		mux.MethodFunc("PUT", "/runtime/endpoint", sensitiveBody(func(w http.ResponseWriter, r *http.Request) {
			caps, err := runtimeFacade.Capabilities(r.Context())
			if err != nil {
				writeRuntimeError(w, http.StatusInternalServerError, "runtime_capabilities_failed", err.Error())
				return
			}
			if !caps.EndpointMutable {
				writeRuntimeError(w, http.StatusMethodNotAllowed, "endpoint_not_mutable", "runtime endpoint is configured by environment")
				return
			}
			input, ok := decodeRemoteEndpointInput(w, r)
			if !ok {
				return
			}
			payload, err := runtimeFacade.UpdateRemoteEndpoint(r.Context(), input)
			if err != nil {
				writeRuntimeFacadeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, payload)
		}))

		mux.MethodFunc("POST", "/runtime/endpoint:test", sensitiveBody(func(w http.ResponseWriter, r *http.Request) {
			input, ok := decodeOptionalRemoteEndpointInput(w, r)
			if !ok {
				return
			}
			payload, err := runtimeFacade.TestRemoteEndpoint(r.Context(), input)
			if err != nil {
				writeRuntimeFacadeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, payload)
		}))

		mux.MethodFunc("GET", "/runtime/gateway", func(w http.ResponseWriter, r *http.Request) {
			caps, err := runtimeFacade.Capabilities(r.Context())
			if err != nil {
				writeRuntimeError(w, http.StatusInternalServerError, "runtime_capabilities_failed", err.Error())
				return
			}
			if caps.Mode == "remote" && !caps.Configured {
				writeGatewayNotConfigured(w, r.Context(), runtimeFacade)
				return
			}
			payload, err := runtimeFacade.RuntimeGatewayStatus(r.Context())
			if err != nil {
				writeRuntimeFacadeError(w, err)
				return
			}
			recordManagedRuntimeStatus(managed, payload)
			writeJSON(w, http.StatusOK, payload)
		})
		registerRuntimeLifecycleRoutes(mux, managed, runtimeFacade)
		return
	}

	mux.MethodFunc("GET", "/runtime/gateway", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, managed.RuntimeGatewayStatusResponse())
	})
}

func registerRuntimeLifecycleRoutes(
	mux interface {
		MethodFunc(string, string, http.HandlerFunc)
	},
	managed openclawrt.ManagedRuntimeSurface,
	runtimeFacade facade.RuntimeFacade,
) {
	type lifecycleAction struct {
		path string
		run  func(context.Context) (facade.RuntimeStatus, error)
	}
	for _, action := range []lifecycleAction{
		{path: "/runtime/gateway/install", run: runtimeFacade.Install},
		{path: "/runtime/gateway/start", run: runtimeFacade.Start},
		{path: "/runtime/gateway/stop", run: runtimeFacade.Stop},
		{path: "/runtime/gateway/restart", run: runtimeFacade.Restart},
		{path: "/runtime/gateway/reinstall", run: runtimeFacade.Reinstall},
		{path: "/runtime/gateway/refresh", run: runtimeFacade.RuntimeGatewayStatus},
	} {
		run := action.run
		mux.MethodFunc("POST", action.path, func(w http.ResponseWriter, r *http.Request) {
			payload, err := run(r.Context())
			recordManagedRuntimeStatus(managed, payload)
			if err != nil {
				writeRuntimeLifecycleError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}
}

type runtimeStatusRecorder interface {
	RecordRuntimeStatus(facade.RuntimeStatus)
}

func recordManagedRuntimeStatus(managed openclawrt.ManagedRuntimeSurface, status facade.RuntimeStatus) {
	if isRuntimeStatusEmpty(status) {
		return
	}
	recorder, ok := managed.(runtimeStatusRecorder)
	if !ok {
		return
	}
	recorder.RecordRuntimeStatus(status)
}

func isRuntimeStatusEmpty(status facade.RuntimeStatus) bool {
	return status.Mode == "" && status.Status == ""
}

func decodeRemoteEndpointInput(w http.ResponseWriter, r *http.Request) (facade.RemoteEndpointInput, bool) {
	var body map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeRuntimeError(w, http.StatusBadRequest, "invalid_json", "invalid json body")
		return facade.RemoteEndpointInput{}, false
	}
	return remoteEndpointInputFromBody(w, body)
}

func decodeOptionalRemoteEndpointInput(w http.ResponseWriter, r *http.Request) (*facade.RemoteEndpointInput, bool) {
	var body map[string]json.RawMessage
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&body); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, true
		}
		writeRuntimeError(w, http.StatusBadRequest, "invalid_json", "invalid json body")
		return nil, false
	}
	if len(body) == 0 {
		return nil, true
	}
	input, ok := remoteEndpointInputFromBody(w, body)
	if !ok {
		return nil, false
	}
	return &input, true
}

func remoteEndpointInputFromBody(w http.ResponseWriter, body map[string]json.RawMessage) (facade.RemoteEndpointInput, bool) {
	rawURL, ok := decodeStringField(body, "url")
	if !ok || !validRuntimeEndpointURL(rawURL) {
		writeRuntimeError(w, http.StatusBadRequest, "invalid_url", "url must be a valid http or https URL")
		return facade.RemoteEndpointInput{}, false
	}
	token, ok := decodeStringField(body, "token")
	if !ok || token == "" {
		writeRuntimeError(w, http.StatusBadRequest, "token_required", "token is required")
		return facade.RemoteEndpointInput{}, false
	}
	tlsVerify, ok := decodeBoolField(body, "tlsVerify")
	if !ok {
		writeRuntimeError(w, http.StatusBadRequest, "invalid_tls_verify", "tlsVerify must be a boolean")
		return facade.RemoteEndpointInput{}, false
	}
	return facade.RemoteEndpointInput{URL: strings.TrimSpace(rawURL), Token: token, TLSVerify: tlsVerify}, true
}

func decodeStringField(body map[string]json.RawMessage, key string) (string, bool) {
	raw, ok := body[key]
	if !ok {
		return "", false
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", false
	}
	return value, true
}

func decodeBoolField(body map[string]json.RawMessage, key string) (bool, bool) {
	raw, ok := body[key]
	if !ok {
		return false, false
	}
	var value bool
	if err := json.Unmarshal(raw, &value); err != nil {
		return false, false
	}
	return value, true
}

func validRuntimeEndpointURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}

func writeRuntimeFacadeError(w http.ResponseWriter, err error) {
	if code, status, ok := facade.CodedErrorInfo(err); ok {
		writeRuntimeError(w, status, code, err.Error())
		return
	}
	switch {
	case errors.Is(err, facade.ErrUnsupported):
		writeRuntimeError(w, http.StatusMethodNotAllowed, "endpoint_not_mutable", "runtime operation is not supported in this mode")
	case errors.Is(err, facade.ErrNotConfigured):
		writeRuntimeError(w, http.StatusServiceUnavailable, "gateway_not_configured", "runtime gateway is not configured")
	default:
		writeRuntimeError(w, http.StatusInternalServerError, "runtime_error", err.Error())
	}
}

func writeRuntimeLifecycleError(w http.ResponseWriter, err error) {
	if errors.Is(err, facade.ErrUnsupported) {
		writeRuntimeError(w, http.StatusMethodNotAllowed, "lifecycle_unsupported_in_remote_mode", "runtime lifecycle is unsupported in remote mode")
		return
	}
	writeRuntimeFacadeError(w, err)
}

func writeRuntimeError(w http.ResponseWriter, status int, code string, message string) {
	writeJSON(w, status, deckapi.DeckGoRuntimeErrorResponse{
		Code:    code,
		Message: message,
	})
}
