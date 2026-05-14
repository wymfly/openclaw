package controld

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

const defaultShutdownTimeout = 10 * time.Second

type RuntimeShutdown interface {
	Stop(ctx context.Context) (facade.RuntimeStatus, error)
}

func RunServer(ctx context.Context, server *http.Server, runtime RuntimeShutdown, serviceName string) error {
	if server == nil {
		return errors.New("RunServer: server is nil")
	}
	log.Printf("%s listening on http://%s", serviceName, server.Addr)
	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), defaultShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("%s shutdown failed: %v", serviceName, err)
		}
		return nil
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}
