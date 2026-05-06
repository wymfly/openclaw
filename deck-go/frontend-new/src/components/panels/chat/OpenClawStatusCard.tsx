type OpenClawStatusItem = {
  label: string;
  value: string;
};

type OpenClawStatusModel = {
  product: string;
  version?: string;
  commit?: string;
  primary: OpenClawStatusItem[];
  metrics: OpenClawStatusItem[];
  details: OpenClawStatusItem[];
};

function cleanSegment(segment: string): string {
  return segment
    .replace(/^[^\w/$.:-]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findValue(segments: string[], label: string): string | undefined {
  const prefix = `${label}:`;
  const segment = segments.find((entry) => entry.toLowerCase().startsWith(prefix.toLowerCase()));
  return segment?.slice(prefix.length).trim() || undefined;
}

function findUnlabeledCredential(segments: string[]): string | undefined {
  return segments.find((entry) => /\b(api-key|oauth|token|keychain)\b/i.test(entry));
}

export function parseOpenClawStatus(text: string): OpenClawStatusModel | null {
  if (!/\bOpenClaw\b/.test(text) || !/\bModel:/i.test(text)) {
    return null;
  }

  const segments = text
    .replace(/\r\n?/g, "\n")
    .split(/\n|\u00b7/u)
    .map(cleanSegment)
    .filter(Boolean);

  const header = segments.find((entry) => /\bOpenClaw\b/.test(entry)) ?? "";
  const versionMatch = header.match(/\bOpenClaw\s+([^\s(]+)(?:\s+\(([^)]+)\))?/);
  const version = versionMatch?.[1];
  const commit = versionMatch?.[2];

  const model = findValue(segments, "Model");
  const runtime = findValue(segments, "Runtime");
  const think = findValue(segments, "Think");
  const tokens = findValue(segments, "Tokens");
  const context = findValue(segments, "Context");
  const cost = findValue(segments, "Cost");
  const compactions = findValue(segments, "Compactions");
  const session = findValue(segments, "Session");
  const queue = findValue(segments, "Queue");
  const auth = findUnlabeledCredential(segments);

  const primary = [
    model ? { label: "Model", value: model } : null,
    runtime ? { label: "Runtime", value: runtime } : null,
    think ? { label: "Think", value: think } : null,
  ].filter((item): item is OpenClawStatusItem => Boolean(item));

  const metrics = [
    tokens ? { label: "Tokens", value: tokens } : null,
    context ? { label: "Context", value: context } : null,
    cost ? { label: "Cost", value: cost } : null,
    compactions ? { label: "Compactions", value: compactions } : null,
  ].filter((item): item is OpenClawStatusItem => Boolean(item));

  const details = [
    session ? { label: "Session", value: session } : null,
    queue ? { label: "Queue", value: queue } : null,
    auth ? { label: "Auth", value: auth } : null,
  ].filter((item): item is OpenClawStatusItem => Boolean(item));

  if (primary.length === 0 && metrics.length === 0 && details.length === 0) {
    return null;
  }

  return {
    product: "OpenClaw",
    version,
    commit,
    primary,
    metrics,
    details,
  };
}

function StatusItems({ items }: { items: OpenClawStatusItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <dl className="ds-openclaw-status-card__items">
      {items.map((item) => (
        <div className="ds-openclaw-status-card__item" key={item.label}>
          <dt>{item.label}</dt>
          <dd title={item.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OpenClawStatusCard({ text }: { text: string }) {
  const status = parseOpenClawStatus(text);
  if (!status) {
    return null;
  }

  return (
    <section className="ds-openclaw-status-card deck-ui-openclaw-status-card">
      <header className="ds-openclaw-status-card__header">
        <span className="ds-openclaw-status-card__product">{status.product}</span>
        {status.version ? (
          <span className="ds-openclaw-status-card__chip">{status.version}</span>
        ) : null}
        {status.commit ? (
          <span className="ds-openclaw-status-card__chip">{status.commit}</span>
        ) : null}
      </header>
      <StatusItems items={status.primary} />
      <StatusItems items={status.metrics} />
      <StatusItems items={status.details} />
    </section>
  );
}
