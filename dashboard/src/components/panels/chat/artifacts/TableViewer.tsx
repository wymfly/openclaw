"use client";
import { useTranslations } from "next-intl";

interface TableViewerProps {
  content: string;
}

export function TableViewer({ content }: TableViewerProps) {
  const t = useTranslations("chat");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return <p className="p-4 text-xs text-[var(--text-secondary)]">{t("artifactCsvEmpty")}</p>;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[var(--bg-tertiary)]">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-semibold text-[var(--text-primary)] border-b border-[var(--border)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-1.5 text-[var(--text-primary)] border-b border-[var(--border-subtle)]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Simple CSV line parser — splits on commas, respects quoted fields. */
function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
