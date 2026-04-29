package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/admin"
)

const adminDialTimeout = 5 * time.Second

func runAdmin(args []string) int {
	return runAdminWithIO(context.Background(), args, os.Getenv, os.Stdout, os.Stderr)
}

func runAdminWithIO(
	parent context.Context,
	args []string,
	getenv func(string) string,
	stdout io.Writer,
	stderr io.Writer,
) int {
	if len(args) != 1 {
		_, _ = fmt.Fprintln(stderr, "usage: deck-go admin <status|reload-runtime>")
		return 2
	}
	ctx, cancel := context.WithTimeout(parent, adminDialTimeout)
	defer cancel()
	raw, err := admin.Request(ctx, admin.EnvSocketPath(getenv), admin.Verb(args[0]))
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "admin %s failed: %v\n", args[0], err)
		return 1
	}
	_, _ = stdout.Write(raw)
	return 0
}
