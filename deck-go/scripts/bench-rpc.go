package main

import (
	"encoding/json"
	"os"
	"runtime"
)

type benchCell struct {
	Cell       string         `json:"cell"`
	P50        float64        `json:"p50"`
	P95        float64        `json:"p95"`
	P99        float64        `json:"p99"`
	Throughput float64        `json:"throughput"`
	ErrorRate  float64        `json:"errorRate"`
	Env        map[string]any `json:"env"`
}

func main() {
	env := map[string]any{
		"os":     runtime.GOOS,
		"arch":   runtime.GOARCH,
		"go":     runtime.Version(),
		"cpu":    runtime.NumCPU(),
		"noProxy": os.Getenv("NO_PROXY"),
	}
	cells := []benchCell{
		{Cell: "http.rpc.models.configured", Env: env},
		{Cell: "http.batch.fanout.1", Env: env},
		{Cell: "http.batch.fanout.8", Env: env},
		{Cell: "http.batch.fanout.16", Env: env},
		{Cell: "http.batch.fanout.32", Env: env},
		{Cell: "ws.rpc.gateway.describe", Env: env},
		{Cell: "ws.batch.fanout.32", Env: env},
		{Cell: "c3.routing.bff", Env: env},
		{Cell: "c3.routing.fallback", Env: env},
		{Cell: "c3.identity.bff", Env: env},
		{Cell: "c3.identity.fallback", Env: env},
		{Cell: "c3.subagents.bff", Env: env},
		{Cell: "c3.subagents.fallback", Env: env},
		{Cell: "c3.lineage.bff", Env: env},
		{Cell: "c3.lineage.fallback", Env: env},
		{Cell: "c3.threads.bff", Env: env},
		{Cell: "c3.threads.fallback", Env: env},
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(cells); err != nil {
		panic(err)
	}
}
