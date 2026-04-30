import { ShieldCheckIcon } from "../../deck-ui/icons";

type ReadOnlyFieldProps = {
  badge?: string;
  label: string;
  value: string;
};

export function ReadOnlyField({ badge, label, value }: ReadOnlyFieldProps) {
  return (
    <label className="deckgo-label">
      <span>
        {label}{" "}
        {badge ? (
          <span className="deckgo-pill">
            <ShieldCheckIcon /> {badge}
          </span>
        ) : null}
      </span>
      <input className="deckgo-input" readOnly value={value} />
    </label>
  );
}
