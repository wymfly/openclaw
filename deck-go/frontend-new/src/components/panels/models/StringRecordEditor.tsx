import { useState } from "react";

function updateStringRecordField(
  current: Record<string, string> | undefined,
  field: string,
  value: string,
): Record<string, string> | undefined {
  const next = { ...current };
  const key = field.trim();
  if (!key) {
    return Object.keys(next).length > 0 ? next : undefined;
  }
  const trimmed = value.trim();
  if (trimmed) {
    next[key] = trimmed;
  } else {
    delete next[key];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function StringRecordEditor(props: {
  addLabel: string;
  ariaPrefix: string;
  emptyText?: string;
  nameLabel: string;
  removeLabel: string;
  title: string;
  value: Record<string, string> | undefined;
  valueLabel: string;
  onChange: (value: Record<string, string> | undefined) => void;
}) {
  const [entryName, setEntryName] = useState("");
  const [entryValue, setEntryValue] = useState("");

  const addEntry = () => {
    props.onChange(updateStringRecordField(props.value, entryName, entryValue));
    setEntryName("");
    setEntryValue("");
  };

  return (
    <div className="deckgo-surface-tile deck-ui-models-surface deck-ui-models-spaced">
      <p className="deckgo-surface-label">{props.title}</p>
      <div className="deckgo-grid deckgo-grid-2 deck-ui-models-grid">
        <label className="deckgo-label deck-ui-models-label">
          <span>{props.nameLabel}</span>
          <input
            aria-label={`${props.ariaPrefix} name`}
            className="deckgo-input deck-ui-models-input"
            value={entryName}
            onChange={(event) => setEntryName(event.target.value)}
          />
        </label>
        <label className="deckgo-label deck-ui-models-label">
          <span>{props.valueLabel}</span>
          <input
            aria-label={`${props.ariaPrefix} value`}
            className="deckgo-input deck-ui-models-input"
            value={entryValue}
            onChange={(event) => setEntryValue(event.target.value)}
          />
        </label>
      </div>
      <div className="deckgo-actions deck-ui-models-actions deck-ui-models-spaced">
        <button
          className="deckgo-button deck-ui-models-button"
          disabled={!entryName.trim() || !entryValue.trim()}
          type="button"
          onClick={addEntry}
        >
          {props.addLabel}
        </button>
      </div>
      {props.value ? (
        <div className="deckgo-pill-row deck-ui-models-pill-row deck-ui-models-spaced">
          {Object.entries(props.value).map(([key, value]) => (
            <button
              className="deckgo-pill"
              key={key}
              type="button"
              onClick={() => props.onChange(updateStringRecordField(props.value, key, ""))}
            >
              {props.removeLabel} {key}={value}
            </button>
          ))}
        </div>
      ) : (
        <p className="deckgo-note">{props.emptyText ?? ""}</p>
      )}
    </div>
  );
}
