# channels - interactions

## Pointer

- Channel rows select the channel and reset channel-local error.
- Refresh reloads channel status and preserves selected channel if possible.
- Logout asks for confirmation before calling the logout wrapper.
- Enable/disable asks for confirmation before calling channel patch.
- Probe calls `testChannel` for the selected channel and shows result locally.
- Throughput window buttons refetch `fetchChannelThroughput(channelId, window)`.
- Open plugin uses `navigateToPlugin`.
- Open routing for WeCom uses `navigateToRouting` with channel/account context.

## Keyboard

- Channel rows are native buttons and must be focusable.
- Form controls keep native labels or aria labels.
- Toggle/checkbox controls expose current state.
- Details/summary disclosure remains keyboard-operable if retained.

## Loading and errors

- Use non-blocking status badges for inventory/throughput/action state.
- Show API errors in the relevant surface rather than global modal.
- Keep stale data visible during refresh unless the selected channel disappears.

## Accessibility

- The panel root should expose `data-testid="channels-panel"` for E2E.
- Throughput chart must include visible numeric in/out text, not only bars.
- Color must not be the only health signal; badges and text labels remain.
- Destructive/state-changing buttons must have clear text.
