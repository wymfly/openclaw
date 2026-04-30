package openclaw

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/access"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw/views"
)

const (
	deckGatewayWSTimeoutCloseCode = 4000
)

var deckGatewayWSClientCounter atomic.Uint64

type deckGatewayWSFrame struct {
	Type    string              `json:"type"`
	ID      string              `json:"id,omitempty"`
	Method  string              `json:"method,omitempty"`
	Params  json.RawMessage     `json:"params,omitempty"`
	OK      bool                `json:"ok,omitempty"`
	Event   string              `json:"event,omitempty"`
	Payload any                 `json:"payload,omitempty"`
	Error   *deckGatewayWSError `json:"error,omitempty"`
}

type deckGatewayWSError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func (m *ManagedRuntime) GatewayUpgradeWS(w http.ResponseWriter, r *http.Request, runtimeID string) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(*http.Request) bool { return true },
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	session := &deckGatewayWSSession{
		managed:       m,
		conn:          conn,
		request:       r.Clone(r.Context()),
		runtimeID:     runtimeID,
		clientID:      fmt.Sprintf("deck-go-bff-ws-%d", deckGatewayWSClientCounter.Add(1)),
		subscriptions: map[string]func(){},
	}
	session.run()
}

type deckGatewayWSSession struct {
	managed       *ManagedRuntime
	conn          *websocket.Conn
	request       *http.Request
	runtimeID     string
	clientID      string
	writeMu       sync.Mutex
	subMu         sync.Mutex
	subscriptions map[string]func()
}

func (s *deckGatewayWSSession) run() {
	defer s.close()
	ctx, cancel := context.WithCancel(s.request.Context())
	defer cancel()
	go s.heartbeat(ctx, cancel)
	_ = s.conn.SetReadDeadline(time.Now().Add(deckGatewayWSPongTimeout()))
	s.conn.SetPongHandler(func(string) error {
		return s.conn.SetReadDeadline(time.Now().Add(deckGatewayWSPongTimeout()))
	})
	for {
		var frame deckGatewayWSFrame
		if err := s.conn.ReadJSON(&frame); err != nil {
			return
		}
		if strings.TrimSpace(frame.Type) != "req" {
			s.writeResponse(frame.ID, nil, &gateway.ErrCode{Code: "INVALID_FRAME", Message: "WebSocket frame type must be req."})
			continue
		}
		go s.handleRequest(ctx, frame)
	}
}

func (s *deckGatewayWSSession) heartbeat(ctx context.Context, cancel context.CancelFunc) {
	ticker := time.NewTicker(deckGatewayWSPingInterval())
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !s.validateToken() {
				s.writeControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "access token changed"))
				cancel()
				_ = s.conn.Close()
				return
			}
			if err := s.writeControl(websocket.PingMessage, []byte("ping")); err != nil {
				cancel()
				return
			}
		}
	}
}

func (s *deckGatewayWSSession) validateToken() bool {
	if s.managed == nil || s.managed.store == nil {
		return true
	}
	ok, _ := access.ValidateRequest(s.request, s.managed.store)
	return ok
}

func (s *deckGatewayWSSession) writeControl(messageType int, data []byte) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	return s.conn.WriteControl(messageType, data, time.Now().Add(5*time.Second))
}

func (s *deckGatewayWSSession) handleRequest(ctx context.Context, frame deckGatewayWSFrame) {
	method := strings.TrimSpace(frame.Method)
	if method == "" {
		s.writeResponse(frame.ID, nil, &gateway.ErrCode{Code: "INVALID_GATEWAY_METHOD", Message: "Gateway method is required."})
		return
	}
	if _, ok := generated.TypedMethodNames[method]; !ok {
		s.writeResponse(frame.ID, nil, &gateway.ErrCode{
			Code:    "INVALID_GATEWAY_METHOD",
			Message: "Gateway method is not available through the typed Deck transport.",
			Details: map[string]any{
				"method": method,
			},
		})
		return
	}

	switch method {
	case "gateway.batch":
		s.handleBatch(ctx, frame)
	case "sessions.messages.subscribe":
		s.handleSubscribe(ctx, frame)
	case "sessions.messages.unsubscribe":
		s.handleUnsubscribe(ctx, frame)
	default:
		if views.IsC3ViewMethod(method) && views.Enabled() {
			params := decodeWSParams(frame.Params)
			payload, err := s.managed.RequestGateway(ctx, s.runtimeID, method, params)
			s.writeResponse(frame.ID, payload, err)
			return
		}
		raw, err := json.Marshal(frame)
		if err != nil {
			s.writeResponse(frame.ID, nil, err)
			return
		}
		response, err := s.managed.BridgeGatewayFrame(ctx, s.runtimeID, raw, s.clientID)
		if err != nil {
			s.writeResponse(frame.ID, nil, err)
			return
		}
		s.writeRaw(response)
	}
}

func (s *deckGatewayWSSession) handleBatch(ctx context.Context, frame deckGatewayWSFrame) {
	var params generated.GatewayBatchParams
	if err := json.Unmarshal(frame.Params, &params); err != nil {
		s.writeResponse(frame.ID, nil, &gateway.ErrCode{Code: "INVALID_REQUEST", Message: "Invalid gateway.batch params."})
		return
	}
	dispatchParams, localEntries, err := prepareWSBatchDispatch(params)
	if err != nil {
		s.writeResponse(frame.ID, nil, err)
		return
	}
	if len(dispatchParams.Calls) == 0 {
		s.writeResponse(frame.ID, mergeWSBatchResults(params, localEntries, generated.GatewayBatchResult{}), nil)
		return
	}
	upstream, err := s.managed.GatewayBatch(ctx, s.runtimeID, dispatchParams)
	if err != nil {
		s.writeResponse(frame.ID, nil, err)
		return
	}
	payload := mergeWSBatchResults(params, localEntries, upstream)
	s.writeResponse(frame.ID, payload, nil)
}

func (s *deckGatewayWSSession) handleSubscribe(ctx context.Context, frame deckGatewayWSFrame) {
	sessionKey := wsSessionKey(frame.Params)
	if sessionKey == "" {
		s.writeResponse(frame.ID, nil, &gateway.ErrCode{Code: "INVALID_REQUEST", Message: "sessions.messages.subscribe requires key."})
		return
	}
	subscriptionKey := "session.message:" + sessionKey
	s.subMu.Lock()
	if _, ok := s.subscriptions[subscriptionKey]; ok {
		s.subMu.Unlock()
		s.writeResponse(frame.ID, map[string]any{"ok": true}, nil)
		return
	}
	s.subMu.Unlock()
	if err := s.managed.SubscribeSession(ctx, sessionKey); err != nil {
		s.writeResponse(frame.ID, nil, err)
		return
	}
	eventCtx, cancel := context.WithCancel(context.Background())
	eventsCh := s.managed.Subscribe(eventCtx)
	stop := func() {
		cancel()
		_ = s.managed.UnsubscribeSession(context.Background(), sessionKey)
	}
	s.subMu.Lock()
	s.subscriptions[subscriptionKey] = stop
	s.subMu.Unlock()
	go s.forwardSessionEvents(eventCtx, eventsCh, sessionKey)
	s.writeResponse(frame.ID, map[string]any{"ok": true}, nil)
}

func (s *deckGatewayWSSession) handleUnsubscribe(ctx context.Context, frame deckGatewayWSFrame) {
	_ = ctx
	sessionKey := wsSessionKey(frame.Params)
	if sessionKey == "" {
		s.writeResponse(frame.ID, nil, &gateway.ErrCode{Code: "INVALID_REQUEST", Message: "sessions.messages.unsubscribe requires key."})
		return
	}
	subscriptionKey := "session.message:" + sessionKey
	s.subMu.Lock()
	stop := s.subscriptions[subscriptionKey]
	delete(s.subscriptions, subscriptionKey)
	s.subMu.Unlock()
	if stop != nil {
		stop()
	}
	s.writeResponse(frame.ID, map[string]any{"ok": true}, nil)
}

func prepareWSBatchDispatch(params generated.GatewayBatchParams) (generated.GatewayBatchParams, []map[string]any, error) {
	if len(params.Calls) == 0 {
		return generated.GatewayBatchParams{}, nil, &gateway.ErrCode{Code: "INVALID_REQUEST", Message: "gateway.batch requires at least one call."}
	}
	if len(params.Calls) > 32 {
		return generated.GatewayBatchParams{}, nil, &gateway.ErrCode{Code: "INVALID_REQUEST", Message: "gateway.batch supports at most 32 calls."}
	}
	localEntries := make([]map[string]any, len(params.Calls))
	dispatchCalls := make([]map[string]any, 0, len(params.Calls))
	for index, call := range params.Calls {
		if entry := validateWSBatchCall(call.Id, call.Method); entry != nil {
			localEntries[index] = entry
			if params.Options.FailFast {
				break
			}
			continue
		}
		dispatchCalls = append(dispatchCalls, map[string]any{
			"id":     call.Id,
			"method": call.Method,
			"params": call.Params,
		})
	}
	return gatewayBatchParamsFromCallMaps(dispatchCalls, params.Options.FailFast, params.Options.TimeoutMs), localEntries, nil
}

func validateWSBatchCall(id string, method string) map[string]any {
	method = strings.TrimSpace(method)
	switch {
	case method == "":
		return wsBatchErrorEntry(id, "INVALID_GATEWAY_METHOD", "Gateway method is required.")
	case method == "gateway.batch":
		return wsBatchErrorEntry(id, "INVALID_REQUEST", "Nested gateway.batch calls are not allowed.")
	case strings.HasSuffix(method, ".subscribe") || strings.HasSuffix(method, ".unsubscribe"):
		return wsBatchErrorEntry(id, "INVALID_REQUEST", "Subscription methods are not allowed in gateway.batch.")
	}
	if _, ok := generated.TypedMethodNames[method]; !ok {
		return wsBatchErrorEntry(id, "INVALID_GATEWAY_METHOD", "Gateway method is not available through the typed Deck transport.")
	}
	return nil
}

func wsBatchErrorEntry(id string, code string, message string) map[string]any {
	return map[string]any{
		"id": id,
		"ok": false,
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
	}
}

func gatewayBatchParamsFromCallMaps(calls []map[string]any, failFast bool, timeoutMs int) generated.GatewayBatchParams {
	raw, _ := json.Marshal(map[string]any{
		"calls": calls,
		"options": map[string]any{
			"failFast":  failFast,
			"timeoutMs": timeoutMs,
		},
	})
	var params generated.GatewayBatchParams
	_ = json.Unmarshal(raw, &params)
	return params
}

func mergeWSBatchResults(params generated.GatewayBatchParams, localEntries []map[string]any, upstream generated.GatewayBatchResult) generated.GatewayBatchResult {
	upstreamEntries := gatewayBatchEntryMaps(upstream)
	upstreamByID := make(map[string]map[string]any, len(upstreamEntries))
	for _, entry := range upstreamEntries {
		upstreamByID[asWSBatchEntryString(entry["id"])] = entry
	}
	entries := make([]map[string]any, 0, len(params.Calls))
	for index, call := range params.Calls {
		if localEntries[index] != nil {
			entries = append(entries, localEntries[index])
			if params.Options.FailFast {
				break
			}
			continue
		}
		if entry := upstreamByID[call.Id]; entry != nil {
			entries = append(entries, entry)
		} else {
			entries = append(entries, wsBatchErrorEntry(call.Id, "UNAVAILABLE", "gateway.batch did not return a result for this call."))
			if params.Options.FailFast {
				break
			}
		}
	}
	return gatewayBatchResultFromEntryMaps(entries)
}

func gatewayBatchEntryMaps(result generated.GatewayBatchResult) []map[string]any {
	raw, _ := json.Marshal(result.Results)
	var entries []map[string]any
	_ = json.Unmarshal(raw, &entries)
	return entries
}

func gatewayBatchResultFromEntryMaps(entries []map[string]any) generated.GatewayBatchResult {
	raw, _ := json.Marshal(map[string]any{"results": entries})
	var result generated.GatewayBatchResult
	_ = json.Unmarshal(raw, &result)
	return result
}

func asWSBatchEntryString(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

func (s *deckGatewayWSSession) forwardSessionEvents(ctx context.Context, eventsCh <-chan events.Event, sessionKey string) {
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-eventsCh:
			if !ok {
				return
			}
			if event.Type != "session.message" || eventSessionKey(event.Data) != sessionKey {
				continue
			}
			var payload any
			if err := json.Unmarshal(event.Data, &payload); err != nil {
				payload = string(event.Data)
			}
			s.writeEvent("session.message", payload)
		}
	}
}

func (s *deckGatewayWSSession) writeResponse(id string, payload any, err error) {
	frame := deckGatewayWSFrame{Type: "res", ID: id, OK: err == nil}
	if err != nil {
		frame.Error = wsErrorFrom(err)
	} else {
		frame.Payload = payload
	}
	s.writeJSON(frame)
}

func (s *deckGatewayWSSession) writeEvent(event string, payload any) {
	s.writeJSON(deckGatewayWSFrame{Type: "event", Event: event, Payload: payload})
}

func (s *deckGatewayWSSession) writeJSON(frame deckGatewayWSFrame) {
	raw, err := json.Marshal(frame)
	if err != nil {
		return
	}
	s.writeRaw(raw)
}

func (s *deckGatewayWSSession) writeRaw(raw []byte) {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	_ = s.conn.WriteMessage(websocket.TextMessage, raw)
}

func (s *deckGatewayWSSession) close() {
	s.subMu.Lock()
	stops := make([]func(), 0, len(s.subscriptions))
	for _, stop := range s.subscriptions {
		stops = append(stops, stop)
	}
	s.subscriptions = map[string]func(){}
	s.subMu.Unlock()
	for _, stop := range stops {
		stop()
	}
	_ = s.conn.Close()
}

func decodeWSParams(raw json.RawMessage) any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	var params any
	if err := json.Unmarshal(raw, &params); err != nil {
		return map[string]any{}
	}
	if params == nil {
		return map[string]any{}
	}
	return params
}

func wsSessionKey(raw json.RawMessage) string {
	var params struct {
		Key string `json:"key"`
	}
	_ = json.Unmarshal(raw, &params)
	return strings.TrimSpace(params.Key)
}

func wsErrorFrom(err error) *deckGatewayWSError {
	var errCode *gateway.ErrCode
	if errors.As(err, &errCode) {
		return &deckGatewayWSError{
			Code:    errCode.Code,
			Message: errCode.Message,
			Details: errCode.Details,
		}
	}
	return &deckGatewayWSError{Code: "GATEWAY_RPC_FAILED", Message: err.Error()}
}

func deckGatewayWSPingInterval() time.Duration {
	return deckGatewayWSDurationFromEnv("DECK_GO_WS_PING_INTERVAL_MS", 30*time.Second)
}

func deckGatewayWSPongTimeout() time.Duration {
	return deckGatewayWSDurationFromEnv("DECK_GO_WS_PONG_TIMEOUT_MS", 60*time.Second)
}

func deckGatewayWSDurationFromEnv(name string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(name))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return time.Duration(value) * time.Millisecond
}

func eventSessionKey(raw []byte) string {
	var record map[string]any
	if err := json.Unmarshal(raw, &record); err != nil {
		return ""
	}
	if key, ok := record["sessionKey"].(string); ok {
		return key
	}
	if key, ok := record["key"].(string); ok {
		return key
	}
	return ""
}
