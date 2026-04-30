package views

import (
	"context"
	"sort"
	"strings"
)

func (r *Registry) IdentityList(ctx context.Context, params any) (any, error) {
	results, err := r.callBatch(ctx, "deck.identity.list", []batchCall{
		{id: "config", method: "config.get", params: map[string]any{}},
	})
	if err != nil {
		return nil, err
	}
	configResult := results["config"]
	config := configPayload(configResult)
	session := asMap(config["session"])
	identityLinks := asMap(session["identityLinks"])

	canonicals := make([]string, 0, len(identityLinks))
	for canonical := range identityLinks {
		canonicals = append(canonicals, canonical)
	}
	sort.Strings(canonicals)

	links := make([]map[string]any, 0, len(canonicals))
	for _, canonical := range canonicals {
		peers := make([]map[string]any, 0)
		for _, rawPeer := range asSlice(identityLinks[canonical]) {
			peer := splitChannelPeer(asString(rawPeer))
			if peer == nil {
				continue
			}
			peers = append(peers, peer)
		}
		links = append(links, map[string]any{
			"canonical": canonical,
			"peers":     peers,
		})
	}

	return map[string]any{
		"links":      links,
		"configHash": configResultHash(configResult),
	}, nil
}

func splitChannelPeer(raw string) map[string]any {
	index := strings.Index(raw, ":")
	if index < 1 {
		return nil
	}
	return map[string]any{
		"channel": raw[:index],
		"peerId":  raw[index+1:],
	}
}
