//go:build windows

package admin

import (
	"bufio"
	"context"
	"encoding/json"
)

func Request(ctx context.Context, path string, verb Verb) (json.RawMessage, error) {
	if path == "" {
		path = DefaultSocketPath()
	}
	type result struct {
		raw json.RawMessage
		err error
	}
	done := make(chan result, 1)
	go func() {
		handle, err := openNamedPipe(path)
		if err != nil {
			done <- result{err: err}
			return
		}
		conn := &pipeConn{handle: handle, addr: pipeAddr(path)}
		defer conn.Close()
		if _, err := conn.Write([]byte(string(verb) + "\n")); err != nil {
			done <- result{err: err}
			return
		}
		line, err := bufio.NewReader(conn).ReadBytes('\n')
		if err != nil {
			done <- result{err: err}
			return
		}
		done <- result{raw: json.RawMessage(line)}
	}()
	select {
	case result := <-done:
		return result.raw, result.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
