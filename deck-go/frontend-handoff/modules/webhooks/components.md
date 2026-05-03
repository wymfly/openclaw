# Webhooks Components

## Component Tree

```text
WebhooksPanel
  WebhookWorkbench
    InventoryColumn
      WebhookHeader
      WebhookMetrics
      WebhookCatalog
        WebhookCatalogRow
      ReceiverFormPanel
        EventSubscriptionStrip
        ReceiverFields
        FormActionBar
      PrimaryActionBar
    DetailColumn
      DetailTabStrip
      SelectedWebhookHero
      SelectedWebhookFacts
      EventSubscriptionPanel
      DeliveryHistoryPanel
        DeliveryRow
      WebhookPayloadDetail
      DeliveryPayloadDetail
      LastActionDetail
```

## Module-Local Molecules

### Webhook header

- Shows title, contract description, load state, configured count, enabled count, failure count, and selected delivery count.
- Reuses prior workbench header rhythm but keeps receiver-specific labels local.

### Webhook metric tile

- Compact tile for configured receivers, enabled receivers, failures, and selected deliveries.
- Repeats prior metric tile molecules but remains local until a dedicated KPI/card proposal defines a shared API.

### Webhook catalog row

- Button row with webhook name, URL, enabled/disabled state, failure count, last status, last fired evidence, and selected state.
- Long receiver URLs wrap inside stable constrained regions.

### Receiver form panel

- Contains name, target URL, optional signing secret, event subscription text, event toggle strip, enabled checkbox, and create/save actions.
- Preserves the current `WebhookDraft` model and wrapper payload shape.

### Selected webhook hero

- Shows selected webhook name, URL, enabled state, event count, failure count, last status, and last fired time.
- Keeps selected identity stable while delivery/test/form actions occur.

### Delivery row

- Shows event type, created time, success/failure, status code, duration, attempt, retry state, and optional response/error detail.
- Stays module-local because delivery evidence has webhook-specific semantics.

### Last action detail

- Uses raw JSON disclosure for create/update/test/delete responses.
- The raw payload is evidence, not primary navigation.

## Props / Data Boundaries

The production implementation may keep helper components under `src/components/panels/webhooks/`. It should not widen public APIs. All data remains internal to `WebhooksPanel` and is sourced from existing `src/api.ts` wrappers.
