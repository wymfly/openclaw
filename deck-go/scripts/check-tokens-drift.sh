#!/usr/bin/env bash
# check-tokens-drift.sh
#
# 验证设计 token 文件双向一致性（protocol-v1 token drift 防护）。
#
# 比较：
#   frontend/src/design-system/tokens/index.css        (canonical — 真实工程)
#   frontend-handoff/design-system/tokens.css           (mirror   — 设计 agent)
#
# 各自顶部的注释 header 不同（一个写的是 "real engineering"，另一个写的是 "design source mirror"），
# 所以脚本只比较从第一个 `:root` 起到文件尾的 token 定义部分。
#
# Exit code:
#   0 — token 定义部分一致
#   1 — 漂移；打印 unified diff 后退出
#   2 — 文件不存在或脚本本身错误
#
# 未来：当 frontend-new 切换日完成时，把 CANONICAL 路径改为 frontend-new/src/design-system/tokens/index.css。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DECK_GO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CANONICAL="$DECK_GO_ROOT/frontend/src/design-system/tokens/index.css"
MIRROR="$DECK_GO_ROOT/frontend-handoff/design-system/tokens.css"

# 一旦 frontend-new 物理树存在并接管 canonical，自动改用 frontend-new
if [[ -f "$DECK_GO_ROOT/frontend-new/src/design-system/tokens/index.css" ]]; then
  CANONICAL="$DECK_GO_ROOT/frontend-new/src/design-system/tokens/index.css"
fi

if [[ ! -f "$CANONICAL" ]]; then
  echo "check-tokens-drift: canonical token file missing: $CANONICAL" >&2
  exit 2
fi

if [[ ! -f "$MIRROR" ]]; then
  echo "check-tokens-drift: mirror token file missing: $MIRROR" >&2
  exit 2
fi

# 提取从第一个 `:root` 开始到文件结尾的部分。
# awk 模式：一旦遇到 /^:root/ 就开始打印。
extract_tokens() {
  awk '/^:root/{p=1} p{print}' "$1"
}

CANONICAL_BODY="$(extract_tokens "$CANONICAL")"
MIRROR_BODY="$(extract_tokens "$MIRROR")"

if [[ "$CANONICAL_BODY" == "$MIRROR_BODY" ]]; then
  echo "check-tokens-drift: ok (token bodies identical from :root onwards)"
  exit 0
fi

echo "check-tokens-drift: DRIFT detected" >&2
echo "  canonical: $CANONICAL" >&2
echo "  mirror   : $MIRROR" >&2
echo "----- unified diff (canonical → mirror) -----" >&2
diff -u <(printf '%s\n' "$CANONICAL_BODY") <(printf '%s\n' "$MIRROR_BODY") || true
exit 1
