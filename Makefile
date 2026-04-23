.PHONY: build deck-go-stage3-host deck-go-stage3-e2e deck-go-stage3-rollback deck-go-stage3-stabilization deck-go-stage3-stabilization-enforce deck-go-stage3-record-incident

build:
	pnpm build

deck-go-stage3-host:
	$(MAKE) -C deck-go smoke-stage3-host

deck-go-stage3-e2e:
	$(MAKE) -C deck-go smoke-stage3-e2e

deck-go-stage3-rollback:
	$(MAKE) -C deck-go smoke-stage3-rollback

deck-go-stage3-stabilization:
	$(MAKE) -C deck-go check-stage3-stabilization

deck-go-stage3-stabilization-enforce:
	$(MAKE) -C deck-go enforce-stage3-stabilization

deck-go-stage3-record-incident:
	$(MAKE) -C deck-go record-stage3-stabilization-incident DATE="$(DATE)" SEVERITY="$(SEVERITY)" SUMMARY="$(SUMMARY)" ATTRIBUTION="$(ATTRIBUTION)" STATUS="$(STATUS)"
