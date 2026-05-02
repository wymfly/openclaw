import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PencilIcon } from "../../../deck-ui/icons";
import { useTranslations } from "../../../i18n/provider";

type InlineEditTextProps = {
  className?: string;
  onConfirm: (value: string) => void;
  placeholder?: string;
  type?: "text";
  value: string;
};

type InlineEditSelectProps = {
  className?: string;
  onConfirm: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  type: "select";
  value: string;
};

export type InlineEditProps = InlineEditSelectProps | InlineEditTextProps;

export function InlineEdit(props: InlineEditProps) {
  const t = useTranslations("lists");
  const [draft, setDraft] = useState(props.value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(props.value);
    }
  }, [editing, props.value]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    if (props.type === "select") {
      selectRef.current?.focus();
    } else {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, props.type]);

  const cancel = () => {
    setDraft(props.value);
    setEditing(false);
  };

  const confirm = () => {
    setEditing(false);
    if (draft !== props.value) {
      props.onConfirm(draft);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirm();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  if (!editing) {
    const displayValue =
      props.type === "select"
        ? (props.options.find((option) => option.value === props.value)?.label ?? props.value)
        : props.value;

    return (
      <button
        className={`deckgo-inline-edit ${props.className ?? ""}`.trim()}
        onClick={() => {
          setDraft(props.value);
          setEditing(true);
        }}
        title={t("inlineEditConfirm")}
        type="button"
      >
        <span className={displayValue ? "" : "is-placeholder"}>
          {displayValue || (props.type === "select" ? "-" : props.placeholder || "-")}
        </span>
        <PencilIcon />
      </button>
    );
  }

  if (props.type === "select") {
    return (
      <select
        className={`deckgo-input deckgo-inline-edit-control ${props.className ?? ""}`.trim()}
        onBlur={cancel}
        onChange={(event) => {
          setDraft(event.target.value);
          setEditing(false);
          if (event.target.value !== props.value) {
            props.onConfirm(event.target.value);
          }
        }}
        onKeyDown={handleKeyDown}
        ref={selectRef}
        value={draft}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={`deckgo-input deckgo-inline-edit-control ${props.className ?? ""}`.trim()}
      onBlur={cancel}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      ref={inputRef}
      type="text"
      value={draft}
    />
  );
}
