import { useTranslations } from "next-intl";

interface FileBlockProps {
  data: string;
  mimeType: string;
  fileName: string;
  size?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBlock({ data, mimeType, fileName, size }: FileBlockProps) {
  const t = useTranslations("chat");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `data:${mimeType};base64,${data}`;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="deck-ui-file-block">
      <span className="deck-ui-file-name">{fileName}</span>
      {size != null ? <span className="deck-ui-file-size">{formatSize(size)}</span> : null}
      <button
        className="deck-ui-tool-control"
        type="button"
        title={t("download")}
        onClick={handleDownload}
      >
        {t("download")}
      </button>
    </div>
  );
}
