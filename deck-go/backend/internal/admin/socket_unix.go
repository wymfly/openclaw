//go:build !windows

package admin

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
)

func StartSocketServer(ctx context.Context, opts SocketOptions) (*SocketServer, error) {
	path := opts.Path
	if path == "" {
		path = DefaultSocketPath()
	}
	if opts.Runtime == nil {
		return nil, fmt.Errorf("admin socket runtime facade is required")
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(dir, 0o700); err != nil {
		return nil, err
	}
	if err := removeStaleSocket(path); err != nil {
		return nil, err
	}
	listener, err := net.Listen("unix", path)
	if err != nil {
		return nil, err
	}
	mode := os.FileMode(0o600)
	if opts.Group != "" {
		resolve := opts.ResolveGroup
		if resolve == nil {
			resolve = lookupGroup
		}
		if gid, ok, err := resolve(opts.Group); err != nil {
			_ = listener.Close()
			_ = os.Remove(path)
			return nil, err
		} else if ok {
			if err := os.Chown(path, os.Getuid(), gid); err != nil {
				_ = listener.Close()
				_ = os.Remove(path)
				return nil, err
			}
			mode = 0o660
		}
	}
	if err := os.Chmod(path, mode); err != nil {
		_ = listener.Close()
		_ = os.Remove(path)
		return nil, err
	}
	if opts.Logf != nil {
		opts.Logf("admin socket listening path=%s mode=%04o group=%q", path, mode, opts.Group)
	}
	return newSocketServer(ctx, listener, path, opts), nil
}

func removeStaleSocket(path string) error {
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSocket == 0 {
		return fmt.Errorf("admin socket path exists and is not a socket: %s", path)
	}
	return os.Remove(path)
}

func lookupGroup(name string) (int, bool, error) {
	group, err := user.LookupGroup(name)
	if err != nil {
		return 0, false, nil
	}
	gid, err := strconv.Atoi(group.Gid)
	if err != nil {
		return 0, false, err
	}
	return gid, true, nil
}
