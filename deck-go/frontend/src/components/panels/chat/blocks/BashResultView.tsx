import { useTranslations } from "next-intl";
import type { BashParsedResult } from "@/lib/tool-result-parser";

export function BashResultView({ result }: { result: BashParsedResult }) {
  const t = useTranslations("chat");
  const isSuccess = result.exitCode === 0;

  return (
    <div className="deck-ui-tool-result-bash" data-tool-result-view="bash">
      {result.command ? (
        <div className="deck-ui-tool-result-command">
          {t("bashCommand")}: <code>$ {result.command}</code>
        </div>
      ) : null}
      <div className={isSuccess ? "deck-ui-tool-result-exit" : "deck-ui-tool-result-exit is-error"}>
        {t("bashExitCode")}: {result.exitCode}
      </div>
      {result.stdout ? (
        <section className="deck-ui-tool-result-stream">
          <strong>{t("bashStdout")}</strong>
          <pre>{result.stdout}</pre>
        </section>
      ) : null}
      {result.stderr ? (
        <section className="deck-ui-tool-result-stream is-error">
          <strong>{t("bashStderr")}</strong>
          <pre>{result.stderr}</pre>
        </section>
      ) : null}
    </div>
  );
}
