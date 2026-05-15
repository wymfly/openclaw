package facade

import (
	"fmt"
	"sync"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

type LocalFactory func(*envconf.RuntimeLocalConfig) (RuntimeFacade, error)
type RemoteFactory func(envconf.RuntimeRemoteDefaults, *runtimestate.Store) RuntimeFacade

var (
	factoryMu     sync.RWMutex
	localFactory  LocalFactory
	remoteFactory RemoteFactory
)

func RegisterLocalFactory(factory LocalFactory) {
	factoryMu.Lock()
	defer factoryMu.Unlock()
	localFactory = factory
}

func RegisterRemoteFactory(factory RemoteFactory) {
	factoryMu.Lock()
	defer factoryMu.Unlock()
	remoteFactory = factory
}

func BuildFacade(cfg *envconf.Loaded, store *runtimestate.Store) (RuntimeFacade, error) {
	if cfg == nil {
		return nil, fmt.Errorf("runtime config is required")
	}
	factoryMu.RLock()
	local := localFactory
	remote := remoteFactory
	factoryMu.RUnlock()
	switch cfg.Mode {
	case envconf.ModeLocal:
		if local == nil {
			return nil, fmt.Errorf("local runtime factory is not registered")
		}
		return local(&cfg.Local)
	case envconf.ModeRemote:
		if remote == nil {
			return nil, fmt.Errorf("remote runtime factory is not registered")
		}
		return remote(cfg.Remote, store), nil
	default:
		return nil, fmt.Errorf("unsupported runtime mode %q", cfg.Mode)
	}
}
