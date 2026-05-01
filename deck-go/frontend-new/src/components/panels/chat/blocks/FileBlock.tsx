import { useTranslations } from "next-intl";
import { Button } from "@/design-system/atoms/Button";
import { Card } from "@/design-system/atoms/Card";

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
    <Card surface="flat" padded={false} className="ds-file-block ds-block--file">
      <span className="ds-file-block__name">{fileName}</span>
      {size != null ? <span className="ds-file-block__size">{formatSize(size)}</span> : null}
      <Button variant="ghost" size="sm" title={t("download")} onClick={handleDownload}>
        {t("download")}
      </Button>
    </Card>
  );
}
