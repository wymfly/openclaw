import { useTranslations } from "next-intl";
import type { BashParsedResult } from "@/lib/tool-result-parser";

export function BashResultView({ result }: { result: BashParsedResult }) {
  const t = useTranslations("chat");
  const isSuccess = result.exitCode === 0;

  const exitClass = isSuccess
    ? "ds-tool-result-exit deck-ui-tool-result-exit"
    : "ds-tool-result-exit deck-ui-tool-result-exit is-error";

  return (
    <div className="ds-tool-result-bash deck-ui-tool-result-bash" data-tool-result-view="bash">
      {result.command ? (
        <div className="ds-tool-result-command deck-ui-tool-result-command">
          {t("bashCommand")}: <code>$ {result.command}</code>
        </div>
      ) : null}
      <div className={exitClass}>
        {t("bashExitCode")}: {result.exitCode}
      </div>
      {result.stdout ? (
        <section className="ds-tool-result-stream deck-ui-tool-result-stream">
          <strong>{t("bashStdout")}</strong>
          <pre>{result.stdout}</pre>
        </section>
      ) : null}
      {result.stderr ? (
        <section className="ds-tool-result-stream deck-ui-tool-result-stream is-error">
          <strong>{t("bashStderr")}</strong>
          <pre>{result.stderr}</pre>
        </section>
      ) : null}
    </div>
  );
}
