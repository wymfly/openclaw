package views

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway/generated"
)

type BatchFunc func(context.Context, generated.GatewayBatchParams) (generated.GatewayBatchResult, error)
type FallbackFunc func(context.Context, string, any) (any, error)
type WarnFunc func(string, ...any)

type Registry struct {
	batch    BatchFunc
	fallback FallbackFunc
	stateDir string
	warnf    WarnFunc
	mu       sync.Mutex
	counts   map[string]viewCounters
}

type viewCounters struct {
	invocations int
	fallbacks   int
	windowStart time.Time
}

type Option func(*Registry)

func WithStateDir(stateDir string) Option {
	return func(r *Registry) {
		r.stateDir = strings.TrimSpace(stateDir)
	}
}

func WithWarnFunc(warnf WarnFunc) Option {
	return func(r *Registry) {
		if warnf != nil {
			r.warnf = warnf
		}
	}
}

func NewRegistry(batch BatchFunc, fallback FallbackFunc, opts ...Option) *Registry {
	registry := &Registry{
		batch:    batch,
		fallback: fallback,
		warnf:    log.Printf,
		counts:   map[string]viewCounters{},
	}
	for _, opt := range opts {
		opt(registry)
	}
	return registry
}

func Enabled() bool {
	return strings.TrimSpace(os.Getenv("DECK_GO_BFF_VIEW_LAYER")) == "1"
}

func FallbackEnabled() bool {
	return strings.TrimSpace(os.Getenv("DECK_GO_BFF_VIEW_FALLBACK")) != "0"
}

func IsC3ViewMethod(method string) bool {
	switch method {
	case "deck.routing.list", "deck.subagents.list", "deck.subagents.lineage", "deck.identity.list", "deck.threads.list":
		return true
	default:
		return false
	}
}

func (r *Registry) Dispatch(ctx context.Context, method string, params any) (any, bool, error) {
	if r == nil || !Enabled() || !IsC3ViewMethod(method) {
		return nil, false, nil
	}
	r.recordInvocation(method)
	payload, err := r.callView(ctx, method, params)
	if err == nil {
		return payload, true, nil
	}
	if !FallbackEnabled() || r.fallback == nil {
		return nil, true, err
	}
	r.recordFallback(method)
	if r.warnf != nil {
		r.warnf("view.fallback method=%s reason=%s", method, err.Error())
	}
	payload, fallbackErr := r.fallback(ctx, method, params)
	if fallbackErr != nil {
		return nil, true, fallbackErr
	}
	return payload, true, nil
}

func (r *Registry) FallbackRate(method string) float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	counters := r.counts[method]
	if counters.invocations == 0 {
		return 0
	}
	return float64(counters.fallbacks) / float64(counters.invocations)
}

func (r *Registry) callView(ctx context.Context, method string, params any) (any, error) {
	switch method {
	case "deck.routing.list":
		return r.RoutingList(ctx, params)
	case "deck.subagents.list":
		return r.SubagentsList(ctx, params)
	case "deck.subagents.lineage":
		return r.SubagentsLineage(ctx, params)
	case "deck.identity.list":
		return r.IdentityList(ctx, params)
	case "deck.threads.list":
		return r.ThreadsList(ctx, params)
	default:
		return nil, fmt.Errorf("unsupported BFF view method %s", method)
	}
}

func (r *Registry) recordInvocation(method string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	counters := r.counts[method]
	if counters.windowStart.IsZero() || time.Since(counters.windowStart) >= 5*time.Minute {
		counters.windowStart = time.Now()
		counters.invocations = 0
		counters.fallbacks = 0
	}
	counters.invocations++
	r.counts[method] = counters
}

func (r *Registry) recordFallback(method string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	counters := r.counts[method]
	counters.fallbacks++
	r.counts[method] = counters
}
