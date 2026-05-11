import { ChannelThroughputChart } from "../parts/ChannelThroughputChart";
import { THROUGHPUT_WINDOWS } from "../types";
import type { ChannelTranslator, DeckGoChannelThroughputBucket, ThroughputWindow } from "../types";

export function TabThroughput(props: {
  buckets: DeckGoChannelThroughputBucket[];
  messagesIn: number;
  messagesOut: number;
  window: ThroughputWindow;
  t: ChannelTranslator;
  onWindowChange: (window: ThroughputWindow) => void;
}) {
  const { buckets, messagesIn, messagesOut, window, t, onWindowChange } = props;
  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">
            {t("throughput")} / {window}
          </h2>
          <p className="section__hint">{t("throughputContractHint")}</p>
        </div>
        <div className="toolbar__filter">
          {THROUGHPUT_WINDOWS.map((entry) => (
            <button
              className={window === entry ? "is-active" : ""}
              key={entry}
              type="button"
              onClick={() => onWindowChange(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
      </header>
      <ChannelThroughputChart
        buckets={buckets}
        messagesIn={messagesIn}
        messagesOut={messagesOut}
        window={window}
        t={t}
      />
    </section>
  );
}
