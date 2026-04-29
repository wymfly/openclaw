package gateway

import (
	"context"
	"errors"
)

type MockRequester struct {
	RequestFunc func(context.Context, string, map[string]any) (any, error)
}

type MockTypedRequester struct {
	RequestTypedFunc func(context.Context, string, any) (any, error)
}

func (m *MockRequester) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	if m != nil && m.RequestFunc != nil {
		return m.RequestFunc(ctx, method, params)
	}
	return nil, errors.New("gateway mock requester has no RequestFunc")
}

func (m *MockTypedRequester) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	if m != nil && m.RequestTypedFunc != nil {
		return m.RequestTypedFunc(ctx, method, params)
	}
	return nil, errors.New("gateway mock requester has no RequestTypedFunc")
}
