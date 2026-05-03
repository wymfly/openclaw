import { ShieldCheckIcon } from "../../deck-ui/icons";
import { Badge, Input } from "../../design-system/atoms";

type ReadOnlyFieldProps = {
  badge?: string;
  label: string;
  value: string;
};

export function ReadOnlyField({ badge, label, value }: ReadOnlyFieldProps) {
  return (
    <label className="settings-label settings-readonly-field">
      <span className="settings-label__text">
        {label}{" "}
        {badge ? (
          <Badge className="settings-secure-badge">
            <ShieldCheckIcon /> {badge}
          </Badge>
        ) : null}
      </span>
      <Input className="settings-input" readOnly value={value} />
    </label>
  );
}
