package admin

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"runtime"
	"strings"
	"sync"
)

type SocketOptions struct {
	Path         string
	Group        string
	Runtime      RuntimeFacade
	Logf         func(string, ...any)
	ResolveGroup func(string) (int, bool, error)
}

type SocketServer struct {
	listener net.Listener
	path     string
	done     chan struct{}
	once     sync.Once
}

func DefaultSocketPath() string {
	if runtime.GOOS == "windows" {
		return `\\.\pipe\deck-go-admin`
	}
	return "/run/deck-go/admin.sock"
}

func EnvSocketPath(getenv func(string) string) string {
	if getenv != nil {
		if path := strings.TrimSpace(getenv("RUNTIME_ADMIN_SOCKET")); path != "" {
			return path
		}
	}
	return DefaultSocketPath()
}

func EnvSocketGroup(getenv func(string) string) string {
	if getenv == nil {
		return ""
	}
	return strings.TrimSpace(getenv("RUNTIME_ADMIN_GROUP"))
}

func (s *SocketServer) Close() error {
	if s == nil || s.listener == nil {
		return nil
	}
	var err error
	s.once.Do(func() {
		err = s.listener.Close()
		<-s.done
	})
	return err
}

func newSocketServer(ctx context.Context, listener net.Listener, path string, opts SocketOptions) *SocketServer {
	server := &SocketServer{listener: listener, path: path, done: make(chan struct{})}
	go server.acceptLoop(RuntimeHandler{Runtime: opts.Runtime}, opts.Logf)
	if ctx != nil {
		go func() {
			<-ctx.Done()
			_ = server.Close()
		}()
	}
	return server
}

func (s *SocketServer) acceptLoop(handler Handler, logf func(string, ...any)) {
	defer close(s.done)
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			if !errors.Is(err, net.ErrClosed) && logf != nil {
				logf("admin socket accept failed: %v", err)
			}
			return
		}
		go handleConn(conn, handler)
	}
}

func handleConn(conn net.Conn, handler Handler) {
	defer conn.Close()
	reader := bufio.NewReader(conn)
	line, err := reader.ReadString('\n')
	if err != nil && strings.TrimSpace(line) == "" {
		writeSocketError(conn, err)
		return
	}
	raw, err := handler.Dispatch(context.Background(), Verb(strings.TrimSpace(line)))
	if err != nil {
		writeSocketError(conn, err)
		return
	}
	_, _ = conn.Write(append(raw, '\n'))
}

func writeSocketError(conn net.Conn, err error) {
	payload, marshalErr := json.Marshal(map[string]any{
		"code":    "admin_error",
		"message": fmt.Sprint(err),
	})
	if marshalErr != nil {
		_, _ = conn.Write([]byte(`{"code":"admin_error","message":"unknown admin socket error"}` + "\n"))
		return
	}
	_, _ = conn.Write(append(payload, '\n'))
}
