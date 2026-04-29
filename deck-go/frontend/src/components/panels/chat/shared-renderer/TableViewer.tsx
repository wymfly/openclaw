import { useTranslations } from "next-intl";

export function TableViewer({ content }: { content: string }) {
  const t = useTranslations("chat");
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    return <p className="ds-artifact-body__empty">{t("artifactCsvEmpty")}</p>;
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);

  return (
    <table className="ds-artifact-body__table">
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={`${index}-${header}`}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={`${cellIndex}-${cell}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"' && inQuotes) {
      current += '"';
      index++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
