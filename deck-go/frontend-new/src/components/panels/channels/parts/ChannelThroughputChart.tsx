import type { ChannelTranslator, DeckGoChannelThroughputBucket, ThroughputWindow } from "../types";

export function ChannelThroughputChart(props: {
  buckets: DeckGoChannelThroughputBucket[];
  messagesIn: number;
  messagesOut: number;
  window: ThroughputWindow;
  t: ChannelTranslator;
}) {
  const maxValue = Math.max(
    1,
    ...props.buckets.map((bucket) => Math.max(bucket.in ?? 0, bucket.out ?? 0)),
  );

  if (props.buckets.length === 0) {
    return (
      <div className="empty empty--compact">
        <strong>{props.t("noThroughputBucketsTitle")}</strong>
        <span>{props.t("noThroughputBuckets", { window: props.window })}</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="chart deck-ui-channels-chart"
        role="img"
        aria-label={props.t("throughputChartLabel", {
          in: props.messagesIn,
          out: props.messagesOut,
        })}
        data-testid="channel-throughput-chart"
      >
        {props.buckets.map((bucket, index) => {
          const inbound = bucket.in ?? 0;
          const outbound = bucket.out ?? 0;
          return (
            <div className="chart__bar" key={`${bucket.time ?? index}:${index}`}>
              <progress className="chart__seg chart__seg--in" max={maxValue} value={inbound} />
              <progress className="chart__seg chart__seg--out" max={maxValue} value={outbound} />
            </div>
          );
        })}
      </div>
      <div className="chart__legend">
        <span>
          <span className="chart__swatch is-in" />
          {props.t("messagesInStat")} {props.messagesIn}
        </span>
        <span>
          <span className="chart__swatch is-out" />
          {props.t("messagesOutStat")} {props.messagesOut}
        </span>
      </div>
    </>
  );
}
