//go:build windows

package admin

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

const (
	pipeAccessDuplex     = 0x00000003
	pipeTypeByte         = 0x00000000
	pipeReadModeByte     = 0x00000000
	pipeWait             = 0x00000000
	pipeUnlimited        = 255
	errorPipeConnected   = syscall.Errno(535)
	genericRead          = 0x80000000
	genericWrite         = 0x40000000
	openExisting         = 3
	defaultPipeBufferLen = 64 * 1024
)

var (
	kernel32                = syscall.NewLazyDLL("kernel32.dll")
	procCreateNamedPipeW    = kernel32.NewProc("CreateNamedPipeW")
	procConnectNamedPipe    = kernel32.NewProc("ConnectNamedPipe")
	procDisconnectNamedPipe = kernel32.NewProc("DisconnectNamedPipe")
)

func StartSocketServer(ctx context.Context, opts SocketOptions) (*SocketServer, error) {
	path := opts.Path
	if path == "" {
		path = DefaultSocketPath()
	}
	if opts.Runtime == nil {
		return nil, fmt.Errorf("admin socket runtime facade is required")
	}
	if !strings.HasPrefix(strings.ToLower(path), `\\.\pipe\`) {
		return nil, fmt.Errorf("admin socket must use a Windows named pipe path, got %q", path)
	}
	listener := newNamedPipeListener(path)
	if opts.Logf != nil {
		opts.Logf("admin socket listening path=%s mode=named-pipe group=%q", path, opts.Group)
	}
	return newSocketServer(ctx, listener, path, opts), nil
}

type namedPipeListener struct {
	path    string
	mu      sync.Mutex
	closed  bool
	pending map[syscall.Handle]struct{}
}

func newNamedPipeListener(path string) *namedPipeListener {
	return &namedPipeListener{path: path, pending: map[syscall.Handle]struct{}{}}
}

func (l *namedPipeListener) Accept() (net.Conn, error) {
	handle, err := createNamedPipe(l.path)
	if err != nil {
		return nil, err
	}
	if !l.track(handle) {
		_ = syscall.CloseHandle(handle)
		return nil, net.ErrClosed
	}
	if err := connectNamedPipe(handle); err != nil {
		l.untrack(handle)
		_ = syscall.CloseHandle(handle)
		if l.isClosed() {
			return nil, net.ErrClosed
		}
		return nil, err
	}
	l.untrack(handle)
	return &pipeConn{handle: handle, disconnectOnClose: true, addr: pipeAddr(l.path)}, nil
}

func (l *namedPipeListener) Close() error {
	l.mu.Lock()
	if l.closed {
		l.mu.Unlock()
		return nil
	}
	l.closed = true
	for handle := range l.pending {
		_ = syscall.CloseHandle(handle)
		delete(l.pending, handle)
	}
	l.mu.Unlock()
	return nil
}

func (l *namedPipeListener) Addr() net.Addr {
	return pipeAddr(l.path)
}

func (l *namedPipeListener) track(handle syscall.Handle) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.closed {
		return false
	}
	l.pending[handle] = struct{}{}
	return true
}

func (l *namedPipeListener) untrack(handle syscall.Handle) {
	l.mu.Lock()
	delete(l.pending, handle)
	l.mu.Unlock()
}

func (l *namedPipeListener) isClosed() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.closed
}

type pipeAddr string

func (a pipeAddr) Network() string { return "npipe" }
func (a pipeAddr) String() string  { return string(a) }

type pipeConn struct {
	handle            syscall.Handle
	disconnectOnClose bool
	addr              pipeAddr
	once              sync.Once
}

func (c *pipeConn) Read(b []byte) (int, error) {
	if len(b) == 0 {
		return 0, nil
	}
	var done uint32
	err := syscall.ReadFile(c.handle, b, &done, nil)
	if err != nil {
		return int(done), err
	}
	return int(done), nil
}

func (c *pipeConn) Write(b []byte) (int, error) {
	written := 0
	for written < len(b) {
		var done uint32
		err := syscall.WriteFile(c.handle, b[written:], &done, nil)
		written += int(done)
		if err != nil {
			return written, err
		}
		if done == 0 {
			return written, nil
		}
	}
	return written, nil
}

func (c *pipeConn) Close() error {
	var err error
	c.once.Do(func() {
		if c.disconnectOnClose {
			disconnectNamedPipe(c.handle)
		}
		err = syscall.CloseHandle(c.handle)
	})
	return err
}

func (c *pipeConn) LocalAddr() net.Addr  { return c.addr }
func (c *pipeConn) RemoteAddr() net.Addr { return c.addr }
func (c *pipeConn) SetDeadline(time.Time) error {
	return nil
}
func (c *pipeConn) SetReadDeadline(time.Time) error {
	return nil
}
func (c *pipeConn) SetWriteDeadline(time.Time) error {
	return nil
}

func createNamedPipe(path string) (syscall.Handle, error) {
	name, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}
	r1, _, callErr := procCreateNamedPipeW.Call(
		uintptr(unsafe.Pointer(name)),
		uintptr(pipeAccessDuplex),
		uintptr(pipeTypeByte|pipeReadModeByte|pipeWait),
		uintptr(pipeUnlimited),
		uintptr(defaultPipeBufferLen),
		uintptr(defaultPipeBufferLen),
		uintptr(0),
		uintptr(0),
	)
	if r1 == ^uintptr(0) {
		return 0, callErr
	}
	return syscall.Handle(r1), nil
}

func connectNamedPipe(handle syscall.Handle) error {
	r1, _, callErr := procConnectNamedPipe.Call(uintptr(handle), uintptr(0))
	if r1 != 0 {
		return nil
	}
	if callErr == errorPipeConnected {
		return nil
	}
	return callErr
}

func disconnectNamedPipe(handle syscall.Handle) {
	_, _, _ = procDisconnectNamedPipe.Call(uintptr(handle))
}

func openNamedPipe(path string) (syscall.Handle, error) {
	name, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0, err
	}
	return syscall.CreateFile(name, genericRead|genericWrite, 0, nil, openExisting, 0, 0)
}
