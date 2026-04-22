package openclaw

import (
	"context"
	"errors"
)

type SessionSubscriptionController interface {
	SubscribeSession(ctx context.Context, key string) error
	UnsubscribeSession(ctx context.Context, key string) error
}

type SessionSubscriptions struct {
	controller SessionSubscriptionController
}

func NewSessionSubscriptions(controller SessionSubscriptionController) *SessionSubscriptions {
	return &SessionSubscriptions{controller: controller}
}

func (s *SessionSubscriptions) SubscribeSession(ctx context.Context, key string) error {
	if s.controller == nil {
		return errors.New("session subscription controller is not configured")
	}
	return s.controller.SubscribeSession(ctx, key)
}

func (s *SessionSubscriptions) UnsubscribeSession(ctx context.Context, key string) error {
	if s.controller == nil {
		return errors.New("session subscription controller is not configured")
	}
	return s.controller.UnsubscribeSession(ctx, key)
}
