//go:build !windows

package admin

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
)

func Request(ctx context.Context, path string, verb Verb) (json.RawMessage, error) {
	if path == "" {
		path = DefaultSocketPath()
	}
	var dialer net.Dialer
	conn, err := dialer.DialContext(ctx, "unix", path)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	if _, err := conn.Write([]byte(string(verb) + "\n")); err != nil {
		return nil, err
	}
	line, err := bufio.NewReader(conn).ReadBytes('\n')
	if err != nil {
		return nil, err
	}
	return json.RawMessage(line), nil
}
