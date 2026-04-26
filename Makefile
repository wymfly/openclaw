.PHONY: build deck-go-stage3-host deck-go-stage3-e2e deck-go-stage3-rollback deck-go-stage3-stabilization deck-go-stage3-stabilization-enforce deck-go-stage3-record-incident

build:
	pnpm build

deck-go-stage3-host:
	@echo "deck-go-stage3-host is deprecated for Codex/Ralph validation; use the Codex Playwright plugin against a managed foreground stack." >&2
	@exit 2

deck-go-stage3-e2e:
	@echo "deck-go-stage3-e2e is deprecated for Codex/Ralph validation; use the Codex Playwright plugin against a managed foreground stack." >&2
	@exit 2

deck-go-stage3-rollback:
	$(MAKE) -C deck-go smoke-stage3-rollback

deck-go-stage3-stabilization:
	$(MAKE) -C deck-go check-stage3-stabilization

deck-go-stage3-stabilization-enforce:
	$(MAKE) -C deck-go enforce-stage3-stabilization

deck-go-stage3-record-incident:
	$(MAKE) -C deck-go record-stage3-stabilization-incident DATE="$(DATE)" SEVERITY="$(SEVERITY)" SUMMARY="$(SUMMARY)" ATTRIBUTION="$(ATTRIBUTION)" STATUS="$(STATUS)"
