import type { ReactNode } from "react";

export type MethodikTableColumn = {
  key: string;
  header: string;
  numeric?: boolean;
};

export function MethodikTable({
  caption,
  columns,
  rows,
  rowHeaders = false,
}: {
  caption?: string;
  columns: readonly MethodikTableColumn[];
  rows: readonly (readonly ReactNode[])[];
  rowHeaders?: boolean;
}) {
  const isKeyValue = columns.length === 2;

  return (
    <div className="my-6 overflow-x-auto">
      <table
        className={`w-full min-w-[28rem] border-collapse text-sm ${
          isKeyValue ? "table-fixed" : ""
        }`}
      >
        {isKeyValue ? (
          <colgroup>
            <col style={{ width: "var(--methodik-kv-label-width, 22rem)" }} />
            <col />
          </colgroup>
        ) : null}
        {caption ? (
          <caption className="mb-2 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr className="border-b border-line">
            {columns.map((column, columnIndex) => {
              const valueCol = isKeyValue && columnIndex === 1;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={`bg-surface-muted px-3 py-2.5 text-xs font-semibold tracking-wide text-ink ${
                    valueCol
                      ? "text-left"
                      : column.numeric
                        ? "text-right"
                        : "text-left"
                  }`}
                >
                  {column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-line-soft"
            >
              {row.map((cell, cellIndex) => {
                const isHeader = rowHeaders && cellIndex === 0;
                const valueCol = isKeyValue && cellIndex === 1;
                const numeric = !valueCol && columns[cellIndex]?.numeric === true;
                const Cell = isHeader ? "th" : "td";
                return (
                  <Cell
                    key={`${rowIndex}-${cellIndex}`}
                    scope={isHeader ? "row" : undefined}
                    className={`px-3 py-2.5 align-top ${
                      isHeader
                        ? "text-left font-medium text-ink"
                        : numeric
                          ? "text-right tabular-nums text-ink-secondary"
                          : "text-left text-ink-secondary"
                    }`}
                  >
                    {cell}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MethodikCsvPreview({
  caption,
  headers,
  rows,
}: {
  caption?: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <MethodikTable
      caption={caption}
      columns={headers.map((header, index) => ({
        key: `${header}-${index}`,
        header,
        numeric: index === headers.length - 1,
      }))}
      rows={rows}
    />
  );
}
