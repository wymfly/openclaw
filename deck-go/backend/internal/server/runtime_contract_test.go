package server

import runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"

var _ RuntimeLifecycleProvider = (*runtimecontrol.Supervisor)(nil)
