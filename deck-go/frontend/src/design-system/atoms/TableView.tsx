import type { ReactNode } from "react";
import "./table-view.css";

export interface TableViewProps {
  /** Header labels. */
  headers: ReactNode[];
  /** Row data — each row's cell count should match `headers.length`; shorter rows render trailing empty cells. */
  rows: ReactNode[][];
  /** Optional row key extractor; defaults to row index. */
  rowKey?: (row: ReactNode[], index: number) => string | number;
  /** Stick the header row to the top of its scroll container. Default: false. */
  stickyHeader?: boolean;
  /** Caption is a TS-encouraged a11y hook (inferred screen-reader name; visually hidden). */
  caption?: string;
  className?: string;
}

/**
 * Text atom: simple data table. Caller pre-parses (CSV → rows). For markdown
 * tables prefer `Markdown` which parses the `| header | … |` syntax inline.
 */
export function TableView({
  headers,
  rows,
  rowKey,
  stickyHeader = false,
  caption,
  className,
}: TableViewProps) {
  const classes = ["ds-table"];
  if (stickyHeader) {
    classes.push("ds-table--sticky");
  }
  if (className) {
    classes.push(className);
  }
  return (
    <div className="ds-table__wrap">
      <table className={classes.join(" ")}>
        {caption ? <caption className="ds-table__caption">{caption}</caption> : null}
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowKey ? rowKey(row, rowIndex) : rowIndex}>
              {headers.map((_, cellIndex) => (
                <td key={cellIndex}>{row[cellIndex] ?? null}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
