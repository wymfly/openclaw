package bundled

import (
	"crypto/sha256"
	"encoding/hex"
)

const (
	ServiceNamePrefix  = "openclaw-gateway."
	ServiceNameHashLen = 12
)

func DeriveServiceName(absRepoPath string) string {
	sum := sha256.Sum256([]byte(absRepoPath))
	return ServiceNamePrefix + hex.EncodeToString(sum[:])[:ServiceNameHashLen]
}
