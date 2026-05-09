import { useEffect, useState } from "react";
import { Banner, Button, Input, Modal } from "@/design-system/atoms";
import { useTranslations } from "@/i18n/provider";

export interface TypeToConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  expectedText: string;
  busy: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (confirmText: string) => void;
}

export function TypeToConfirmDialog(props: TypeToConfirmDialogProps) {
  const t = useTranslations("models");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!props.open) {
      setValue("");
    }
  }, [props.open]);

  const matches =
    value.trim() === props.expectedText.trim() && props.expectedText.trim().length > 0;

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      size="sm"
      dismissOnScrimClick={false}
      aria-label={props.title}
    >
      <header className="models-dialog-head">
        <h3>{props.title}</h3>
      </header>
      {props.errorMessage ? <Banner variant="error">{props.errorMessage}</Banner> : null}
      <div className="models-dialog-body">
        <p>{props.description}</p>
        <p className="models-dialog-meta">
          {t("confirmDialog.typePrompt", { text: props.expectedText })}
        </p>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
          aria-label={t("confirmDialog.inputLabel")}
        />
      </div>
      <footer className="models-dialog-foot">
        <Button variant="ghost" size="sm" onClick={props.onCancel} disabled={props.busy}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => props.onConfirm(value.trim())}
          disabled={!matches || props.busy}
        >
          {props.busy ? t("actions.deleting") : t("actions.confirm")}
        </Button>
      </footer>
    </Modal>
  );
}
