type SessionKeyDisplayProps = {
  sessionKey: string;
};

const segmentClasses = ["is-primary", "is-positive", "is-warning", "is-accent", "is-info"];

export function SessionKeyDisplay(props: SessionKeyDisplayProps) {
  const segments = props.sessionKey.split(":");

  return (
    <span className="deckgo-session-key">
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`}>
          {index > 0 ? <span className="deckgo-session-key-separator">:</span> : null}
          <span className={segmentClasses[index % segmentClasses.length]}>{segment}</span>
        </span>
      ))}
    </span>
  );
}
