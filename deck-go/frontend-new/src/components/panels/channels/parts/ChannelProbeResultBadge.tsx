import { channelProbeLabel, channelProbeTone } from "../lib/channel-selectors";
import type { ChannelTranslator, DeckGoChannelTestResponse } from "../types";

export function ChannelProbeResultBadge(props: {
  result: DeckGoChannelTestResponse;
  t: ChannelTranslator;
}) {
  return (
    <div className="deckgo-pill-row deck-ui-channels-status-row">
      <span className={`deckgo-pill ${channelProbeTone(props.result)}`}>
        {channelProbeLabel(props.result, props.t)}
      </span>
      {props.result.latencyMs != null ? (
        <span className="deckgo-pill">{props.result.latencyMs}ms</span>
      ) : null}
      {props.result.error ? (
        <span className="deckgo-pill is-muted">{props.result.error}</span>
      ) : null}
    </div>
  );
}
