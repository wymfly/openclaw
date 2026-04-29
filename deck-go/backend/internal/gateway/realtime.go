package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

var ErrConnectionLost = errors.New("gateway realtime connection lost")

type Realtime struct {
	provider ConnectionProvider
	bus      *events.Bus

	mu                       sync.Mutex
	writeMu                  sync.Mutex
	conn                     *websocket.Conn
	connectInProgress        chan struct{}
	connectErr               error
	connectCancel            context.CancelFunc
	reconnectInProgress      bool
	closeCh                  chan struct{}
	dispatchDone             chan struct{}
	closed                   bool
	pending                  map[string]chan responseResult
	lifecycleSubscribed      bool
	lifecycleRefCount        int
	sessionSubs              map[string]int
	dispatchQueue            chan eventDispatchItem
	eventSubscribers         map[int]eventSubscriber
	nextSubscriberID         int
	dispatchOverflows        atomic.Int64
	subscriberOverflows      atomic.Int64
	unsubscribeErrors        atomic.Int64
	subscriptionDecodeErrors atomic.Int64
}

type responseResult struct {
	payload any
	err     error
}

type eventDispatchItem struct {
	event   string
	payload json.RawMessage
}

type eventSubscriber struct {
	id         int
	eventName  string
	sessionKey string
	ch         chan json.RawMessage
}

func NewRealtime(provider ConnectionProvider, bus *events.Bus) *Realtime {
	if bus == nil {
		bus = events.NewNoopBus()
	}
	realtime := &Realtime{
		provider:         provider,
		bus:              bus,
		closeCh:          make(chan struct{}),
		dispatchDone:     make(chan struct{}),
		pending:          map[string]chan responseResult{},
		sessionSubs:      map[string]int{},
		dispatchQueue:    make(chan eventDispatchItem, eventDispatchQueueSize()),
		eventSubscribers: map[int]eventSubscriber{},
	}
	go realtime.dispatchLoop()
	return realtime
}

func eventDispatchQueueSize() int {
	const defaultSize = 256
	raw := strings.TrimSpace(os.Getenv("GATEWAY_EVENT_DISPATCH_QUEUE_SIZE"))
	if raw == "" {
		return defaultSize
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return defaultSize
	}
	return value
}

func (r *Realtime) RegisterEventChannel(eventName string, sessionKey string, ch chan json.RawMessage) func() {
	eventName = strings.TrimSpace(eventName)
	if eventName == "" || ch == nil {
		return func() {}
	}
	r.mu.Lock()
	r.nextSubscriberID++
	id := r.nextSubscriberID
	r.eventSubscribers[id] = eventSubscriber{
		id:         id,
		eventName:  eventName,
		sessionKey: strings.TrimSpace(sessionKey),
		ch:         ch,
	}
	r.mu.Unlock()
	return func() {
		r.mu.Lock()
		delete(r.eventSubscribers, id)
		r.mu.Unlock()
	}
}

func (r *Realtime) EventDispatchOverflowTotal() int64 {
	return r.dispatchOverflows.Load()
}

func (r *Realtime) EventSubscriberOverflowTotal() int64 {
	return r.subscriberOverflows.Load()
}

func (r *Realtime) RecordUnsubscribeError(error) {
	r.unsubscribeErrors.Add(1)
}

func (r *Realtime) UnsubscribeErrorsTotal() int64 {
	return r.unsubscribeErrors.Load()
}

func (r *Realtime) RecordSubscriptionDecodeError(error) {
	r.subscriptionDecodeErrors.Add(1)
}

func (r *Realtime) SubscriptionDecodeErrorsTotal() int64 {
	return r.subscriptionDecodeErrors.Load()
}

func (r *Realtime) SubscribeSessions(ctx context.Context) error {
	if err := r.ensureConnected(ctx); err != nil {
		return err
	}
	r.mu.Lock()
	needsLifecycle := !r.lifecycleSubscribed
	r.mu.Unlock()
	if needsLifecycle {
		if _, err := r.doRequest(ctx, "sessions.subscribe", map[string]any{}); err != nil {
			return err
		}
		r.mu.Lock()
		r.lifecycleSubscribed = true
		r.mu.Unlock()
	}
	r.mu.Lock()
	r.lifecycleRefCount++
	r.mu.Unlock()
	return nil
}

func (r *Realtime) UnsubscribeSessions(ctx context.Context) error {
	if err := r.ensureConnected(ctx); err != nil {
		return err
	}
	r.mu.Lock()
	if r.lifecycleRefCount == 0 {
		r.mu.Unlock()
		return nil
	}
	r.lifecycleRefCount--
	needsLifecycleUnsubscribe := r.lifecycleRefCount == 0 && r.lifecycleSubscribed
	r.mu.Unlock()
	if !needsLifecycleUnsubscribe {
		return nil
	}
	if _, err := r.doRequest(ctx, "sessions.unsubscribe", map[string]any{}); err != nil {
		return err
	}
	r.mu.Lock()
	r.lifecycleSubscribed = false
	r.mu.Unlock()
	return nil
}

func (r *Realtime) SubscribeSession(ctx context.Context, key string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("session key is required")
	}
	if err := r.ensureConnected(ctx); err != nil {
		return err
	}

	r.mu.Lock()
	alreadySubscribed := r.sessionSubs[key] > 0
	lifecycleSubscribed := r.lifecycleSubscribed
	r.mu.Unlock()

	if !lifecycleSubscribed {
		if _, err := r.doRequest(ctx, "sessions.subscribe", map[string]any{}); err != nil {
			return err
		}
		r.mu.Lock()
		r.lifecycleSubscribed = true
		r.mu.Unlock()
	}
	if !alreadySubscribed {
		if _, err := r.doRequest(ctx, "sessions.messages.subscribe", map[string]any{"key": key}); err != nil {
			return err
		}
	}
	r.mu.Lock()
	r.lifecycleRefCount++
	r.sessionSubs[key]++
	r.mu.Unlock()
	return nil
}

func (r *Realtime) UnsubscribeSession(ctx context.Context, key string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("session key is required")
	}
	if err := r.ensureConnected(ctx); err != nil {
		return err
	}

	r.mu.Lock()
	count := r.sessionSubs[key]
	r.mu.Unlock()
	if count == 0 {
		return nil
	}
	if count > 1 {
		r.mu.Lock()
		r.sessionSubs[key]--
		if r.lifecycleRefCount > 0 {
			r.lifecycleRefCount--
		}
		r.mu.Unlock()
		return nil
	}
	if _, err := r.doRequest(ctx, "sessions.messages.unsubscribe", map[string]any{"key": key}); err != nil {
		return err
	}
	r.mu.Lock()
	delete(r.sessionSubs, key)
	if r.lifecycleRefCount > 0 {
		r.lifecycleRefCount--
	}
	needsLifecycleUnsubscribe := r.lifecycleRefCount == 0 && r.lifecycleSubscribed
	r.mu.Unlock()
	if needsLifecycleUnsubscribe {
		if _, err := r.doRequest(ctx, "sessions.unsubscribe", map[string]any{}); err != nil {
			return err
		}
		r.mu.Lock()
		r.lifecycleSubscribed = false
		r.mu.Unlock()
	}
	return nil
}

func (r *Realtime) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	return r.RequestTyped(ctx, method, params)
}

func (r *Realtime) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	if strings.TrimSpace(method) == "" {
		return nil, errors.New("gateway method is required")
	}
	if err := r.ensureConnected(ctx); err != nil {
		return nil, err
	}
	return r.doRequest(ctx, method, params)
}

func (r *Realtime) ensureConnected(ctx context.Context) error {
	for {
		r.mu.Lock()
		if r.closed {
			r.mu.Unlock()
			return ErrConnectionLost
		}
		if wait := r.connectInProgress; wait != nil {
			r.mu.Unlock()
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-wait:
			}
			r.mu.Lock()
			err := r.connectErr
			connected := r.conn != nil
			r.mu.Unlock()
			if connected {
				return nil
			}
			if err != nil {
				return err
			}
			continue
		}
		if r.conn != nil {
			r.mu.Unlock()
			return nil
		}

		wait := make(chan struct{})
		connectCtx, cancel := context.WithCancel(ctx)
		r.connectInProgress = wait
		r.connectErr = nil
		r.connectCancel = cancel
		r.mu.Unlock()

		conn, err := r.connect(connectCtx)
		cancel()

		if err == nil {
			r.mu.Lock()
			if r.closed {
				err = ErrConnectionLost
				_ = conn.Close()
				conn = nil
			} else {
				r.conn = conn
				r.pending = map[string]chan responseResult{}
			}
			r.mu.Unlock()
		}
		if err == nil {
			go r.readLoop(conn)
			if restoreErr := r.restoreSubscriptions(ctx); restoreErr != nil {
				r.closeConnection(conn, ErrConnectionLost)
				err = restoreErr
			}
		}

		r.mu.Lock()
		r.connectErr = err
		r.connectInProgress = nil
		r.connectCancel = nil
		close(wait)
		r.mu.Unlock()

		return err
	}
}

func (r *Realtime) connect(ctx context.Context) (*websocket.Conn, error) {
	if r.provider == nil {
		return nil, errors.New("gateway connection provider is not configured")
	}
	upstreamURL, token, ok := r.provider.GatewayConnection()
	if !ok {
		return nil, errors.New("managed gateway connection is not configured")
	}

	dialer := websocket.Dialer{HandshakeTimeout: 8 * time.Second}
	conn, _, err := dialer.DialContext(ctx, upstreamURL, http.Header{})
	if err != nil {
		return nil, err
	}

	if err := completeConnect(ctx, conn, token, "gateway-client"); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return conn, nil
}

func (r *Realtime) restoreSubscriptions(ctx context.Context) error {
	r.mu.Lock()
	needsLifecycle := r.lifecycleRefCount > 0
	sessionKeys := make([]string, 0, len(r.sessionSubs))
	for key, count := range r.sessionSubs {
		if count == 0 {
			continue
		}
		sessionKeys = append(sessionKeys, key)
	}
	r.mu.Unlock()

	if needsLifecycle || len(sessionKeys) > 0 {
		if _, err := r.doRequest(ctx, "sessions.subscribe", map[string]any{}); err != nil {
			if isPermanentSubscriptionRestoreError(err) {
				slog.Warn("gateway lifecycle subscription restore disabled", "err", err)
				r.mu.Lock()
				r.lifecycleRefCount = 0
				r.lifecycleSubscribed = false
				r.mu.Unlock()
				if len(sessionKeys) == 0 {
					return nil
				}
			} else {
				return err
			}
		} else {
			r.mu.Lock()
			r.lifecycleSubscribed = true
			r.mu.Unlock()
		}
	}
	for _, key := range sessionKeys {
		if _, err := r.doRequest(ctx, "sessions.messages.subscribe", map[string]any{"key": key}); err != nil {
			if isPermanentSubscriptionRestoreError(err) {
				slog.Warn("gateway session subscription restore disabled", "session_key", key, "err", err)
				r.mu.Lock()
				delete(r.sessionSubs, key)
				r.mu.Unlock()
				continue
			}
			return err
		}
	}
	return nil
}

func isPermanentSubscriptionRestoreError(err error) bool {
	if errors.Is(err, ErrScopeDenied) {
		return true
	}
	var errCode *ErrCode
	if !errors.As(err, &errCode) {
		return false
	}
	switch errCode.Code {
	case "scope_denied", "not_found", "validation_failed":
		return true
	default:
		return false
	}
}

func (r *Realtime) doRequest(ctx context.Context, method string, params any) (any, error) {
	r.mu.Lock()
	conn := r.conn
	r.mu.Unlock()
	if conn == nil {
		return nil, ErrConnectionLost
	}
	id := nextID()
	ch := make(chan responseResult, 1)

	r.mu.Lock()
	r.pending[id] = ch
	r.mu.Unlock()

	r.writeMu.Lock()
	err := conn.WriteJSON(frame{
		Type:   frameTypeReq,
		ID:     id,
		Method: method,
		Params: normalizeFrameParams(params),
	})
	r.writeMu.Unlock()
	if err != nil {
		r.mu.Lock()
		delete(r.pending, id)
		r.mu.Unlock()
		r.closeConnection(conn, ErrConnectionLost)
		return nil, err
	}

	select {
	case <-ctx.Done():
		r.mu.Lock()
		delete(r.pending, id)
		r.mu.Unlock()
		return nil, ctx.Err()
	case result := <-ch:
		return result.payload, result.err
	}
}

func (r *Realtime) readLoop(conn *websocket.Conn) {
	defer func() {
		if rec := recover(); rec != nil {
			r.closeConnection(conn, fmt.Errorf("gateway: readLoop panic: %w: %v", ErrConnectionLost, rec))
		}
	}()
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			r.closeConnection(conn, ErrConnectionLost)
			return
		}
		var fr frame
		if err := json.Unmarshal(raw, &fr); err != nil {
			continue
		}
		switch fr.Type {
		case frameTypeRes:
			r.mu.Lock()
			ch := r.pending[fr.ID]
			delete(r.pending, fr.ID)
			r.mu.Unlock()
			if ch != nil {
				if fr.Error != nil {
					ch <- responseResult{err: FromEnvelope(fr.Error)}
				} else {
					ch <- responseResult{payload: fr.Payload}
				}
			}
		case frameTypeEvent:
			if fr.Event == "connect.challenge" {
				continue
			}
			payload, _ := json.Marshal(fr.Payload)
			r.bus.Publish(fr.Event, payload)
			r.enqueueEvent(fr.Event, payload)
		}
	}
}

func (r *Realtime) enqueueEvent(eventName string, payload json.RawMessage) {
	item := eventDispatchItem{
		event:   eventName,
		payload: append(json.RawMessage(nil), payload...),
	}
	select {
	case r.dispatchQueue <- item:
	default:
		r.dispatchOverflows.Add(1)
		select {
		case <-r.dispatchQueue:
		default:
		}
		select {
		case r.dispatchQueue <- item:
		default:
			r.dispatchOverflows.Add(1)
		}
	}
}

func (r *Realtime) dispatchLoop() {
	defer close(r.dispatchDone)
	for {
		select {
		case <-r.closeCh:
			return
		case item := <-r.dispatchQueue:
			r.dispatchEvent(item)
		}
	}
}

func (r *Realtime) dispatchEvent(item eventDispatchItem) {
	sessionKey := eventSessionKey(item.payload)
	r.mu.Lock()
	subscribers := make([]eventSubscriber, 0, len(r.eventSubscribers))
	for _, subscriber := range r.eventSubscribers {
		if subscriber.eventName != item.event {
			continue
		}
		if subscriber.sessionKey != "" && subscriber.sessionKey != sessionKey {
			continue
		}
		subscribers = append(subscribers, subscriber)
	}
	r.mu.Unlock()

	for _, subscriber := range subscribers {
		if !r.eventSubscriberRegistered(subscriber.id) {
			continue
		}
		payload := append(json.RawMessage(nil), item.payload...)
		select {
		case subscriber.ch <- payload:
		default:
			r.subscriberOverflows.Add(1)
			select {
			case <-subscriber.ch:
			default:
			}
			select {
			case subscriber.ch <- payload:
			default:
				r.subscriberOverflows.Add(1)
			}
		}
	}
}

func (r *Realtime) eventSubscriberRegistered(id int) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.eventSubscribers[id]
	return ok
}

func eventSessionKey(payload json.RawMessage) string {
	var record map[string]any
	if err := json.Unmarshal(payload, &record); err != nil {
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

func (r *Realtime) closeConnection(conn *websocket.Conn, err error) {
	r.mu.Lock()
	shouldReconnect := false
	if r.conn == conn {
		r.conn = nil
		shouldReconnect = !r.closed
	}
	for id, ch := range r.pending {
		ch <- responseResult{err: err}
		delete(r.pending, id)
	}
	r.lifecycleSubscribed = false
	r.mu.Unlock()
	_ = conn.Close()
	if shouldReconnect {
		r.startReconnectLoop()
	}
}

func (r *Realtime) Close() error {
	r.mu.Lock()
	if r.closed {
		dispatchDone := r.dispatchDone
		r.mu.Unlock()
		if dispatchDone != nil {
			<-dispatchDone
		}
		return nil
	}
	r.closed = true
	close(r.closeCh)
	dispatchDone := r.dispatchDone
	cancel := r.connectCancel
	conn := r.conn
	r.conn = nil
	for id, ch := range r.pending {
		ch <- responseResult{err: ErrConnectionLost}
		delete(r.pending, id)
	}
	r.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if dispatchDone != nil {
		<-dispatchDone
	}
	if conn != nil {
		return conn.Close()
	}
	return nil
}

func (r *Realtime) startReconnectLoop() {
	r.mu.Lock()
	if r.closed || r.reconnectInProgress {
		r.mu.Unlock()
		return
	}
	r.reconnectInProgress = true
	r.mu.Unlock()

	go func() {
		defer func() {
			r.mu.Lock()
			r.reconnectInProgress = false
			r.mu.Unlock()
		}()
		for attempt := 0; ; attempt++ {
			delay := reconnectDelay(attempt)
			timer := time.NewTimer(delay)
			select {
			case <-timer.C:
			case <-r.closeCh:
				timer.Stop()
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			err := r.ensureConnected(ctx)
			cancel()
			if err == nil {
				return
			}

			select {
			case <-r.closeCh:
				return
			default:
			}
		}
	}()
}

func reconnectDelay(attempt int) time.Duration {
	delays := []time.Duration{
		time.Second,
		2 * time.Second,
		4 * time.Second,
		8 * time.Second,
		16 * time.Second,
		30 * time.Second,
	}
	if attempt < 0 {
		attempt = 0
	}
	if attempt >= len(delays) {
		return 30 * time.Second
	}
	return delays[attempt]
}
