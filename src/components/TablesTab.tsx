import React, { useState, useMemo } from "react";
import { Table, Layers, ArrowLeftRight, ChevronLeft, ChevronRight, Hash, Copy, Check } from "lucide-react";
import { RhwpTablesData, RhwpTableItem, TableCell } from "../types";

interface TablesTabProps {
  tablesData: RhwpTablesData | null;
}

export const TablesTab: React.FC<TablesTabProps> = ({ tablesData }) => {
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(50);
  const [copied, setCopied] = useState(false);

  const tables = tablesData?.tables || [];
  const tableCount = tablesData?.tableCount ?? tables.length;

  const currentTable: RhwpTableItem | undefined = tables[selectedTableIndex];

  // Calculate table metrics and rows
  const { rows, maxRow, maxCol } = useMemo(() => {
    if (!currentTable || !currentTable.cells || currentTable.cells.length === 0) {
      return { rows: [], maxRow: 0, maxCol: 0 };
    }

    let calculatedMaxRow = 0;
    let calculatedMaxCol = 0;
    const rowGroupMap = new Map<number, TableCell[]>();

    for (const cell of currentTable.cells) {
      if (cell.row > calculatedMaxRow) calculatedMaxRow = cell.row;
      if (cell.col > calculatedMaxCol) calculatedMaxCol = cell.col;

      const group = rowGroupMap.get(cell.row) || [];
      group.push(cell);
      rowGroupMap.set(cell.row, group);
    }

    const sortedRowKeys = Array.from(rowGroupMap.keys()).sort((a, b) => a - b);
    const sortedRows = sortedRowKeys.map((r) => {
      const cells = rowGroupMap.get(r) || [];
      cells.sort((a, b) => a.col - b.col);
      return { rowNum: r, cells };
    });

    return {
      rows: sortedRows,
      maxRow: calculatedMaxRow + 1,
      maxCol: calculatedMaxCol + 1,
    };
  }, [currentTable]);

  if (!tablesData || tableCount === 0 || tables.length === 0) {
    return (
      <div className="p-12 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
        <Table className="w-10 h-10 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-stone-800 mb-1">
          추출된 표가 없습니다
        </h3>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          문서에 표가 존재하지 않거나 rhwp export-tables가 표를 검출하지 못했습니다 (tableCount: 0).
          실제 rhwp 반환 데이터는 Raw JSON 탭에서 확인하실 수 있습니다.
        </p>
      </div>
    );
  }

  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const pagedRows = pageSize === 0 ? rows : rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleCopyTableCsv = () => {
    if (!rows.length) return;
    const csvContent = rows
      .map((r) =>
        r.cells
          .map((c) => `"${(c.text || "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Selector & Info Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Table Selector */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-500" />
            <span className="text-xs font-semibold text-stone-700">표 선택:</span>
            <select
              id="select-table-index"
              aria-label="표 선택"
              value={selectedTableIndex}
              onChange={(e) => {
                setSelectedTableIndex(parseInt(e.target.value, 10));
                setPageIndex(0);
              }}
              className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-900 font-medium focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {tables.map((tbl, idx) => (
                <option key={idx} value={idx}>
                  표 {idx + 1} (총 {tbl.cellCount.toLocaleString()}개 셀)
                </option>
              ))}
            </select>
          </div>

          {/* Table Dimension Info */}
          <div className="flex items-center gap-2 text-xs text-stone-600 bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-md font-mono">
            <span>크기: <strong className="text-stone-900">{maxRow}</strong>행 × <strong className="text-stone-900">{maxCol}</strong>열</span>
            <span className="text-stone-300">•</span>
            <span>총 셀 수: <strong className="text-stone-900">{currentTable?.cellCount.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Actions & Pagination controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Row size selector */}
          <div className="flex items-center gap-1.5 text-xs text-stone-600">
            <span>행 표시:</span>
            <select
              aria-label="행 표시 단위 선택"
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPageIndex(0);
              }}
              className="text-xs bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-stone-800"
            >
              <option value={20}>20행씩</option>
              <option value={50}>50행씩</option>
              <option value={100}>100행씩</option>
              <option value={0}>전체 행</option>
            </select>
          </div>

          {/* Pagination buttons */}
          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                aria-label="이전 페이지"
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                disabled={pageIndex === 0}
                className="p-1 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-stone-600 px-1">
                {pageIndex + 1} / {totalPages}
              </span>
              <button
                type="button"
                aria-label="다음 페이지"
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                disabled={pageIndex >= totalPages - 1}
                className="p-1 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Copy as CSV */}
          <button
            type="button"
            onClick={handleCopyTableCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "복사됨" : "CSV 복사"}</span>
          </button>
        </div>
      </div>

      {/* Render HTML Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-800">
              HTML Table 렌더링 뷰 (Table #{selectedTableIndex + 1})
            </span>
            <span className="text-stone-400">|</span>
            <span>병합 정보(rowspan/colspan) 및 Header 속성 반영</span>
          </div>
          {pageSize > 0 && totalRows > pageSize && (
            <span className="text-[11px] text-stone-500 font-mono">
              표시 중: {pageIndex * pageSize + 1} ~ {Math.min(totalRows, (pageIndex + 1) * pageSize)} 행 (총 {totalRows}행)
            </span>
          )}
        </div>

        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {pagedRows.map((rowItem) => {
                const rNum = rowItem.rowNum;
                return (
                  <tr key={rNum} className="border-b border-stone-200 hover:bg-stone-50/50">
                    {/* Row Index Indicator */}
                    <td className="w-12 px-2 py-1.5 font-mono text-[10px] text-stone-400 bg-stone-50/80 border-r border-stone-200 text-center select-none">
                      {rNum + 1}
                    </td>

                    {rowItem.cells.map((cell, cIdx) => {
                      const hasRowSpan = cell.rowSpan && cell.rowSpan > 1;
                      const hasColSpan = cell.colSpan && cell.colSpan > 1;
                      const isHeader = cell.isHeader;

                      return (
                        <td
                          key={cIdx}
                          rowSpan={hasRowSpan ? cell.rowSpan : undefined}
                          colSpan={hasColSpan ? cell.colSpan : undefined}
                          className={`p-2.5 border border-stone-200 align-top transition-colors ${
                            isHeader
                              ? "bg-stone-100 font-semibold text-stone-900"
                              : "text-stone-800"
                          } ${
                            hasRowSpan || hasColSpan
                              ? "bg-amber-50/30"
                              : ""
                          }`}
                        >
                          {/* Span indicator tag if merged */}
                          {(hasRowSpan || hasColSpan) && (
                            <div className="mb-1 flex items-center gap-1 font-mono text-[9px] text-amber-800">
                              <span className="px-1 py-0.2 rounded bg-amber-100/80 border border-amber-200">
                                {hasRowSpan && `row:${cell.rowSpan}`}
                                {hasRowSpan && hasColSpan && " "}
                                {hasColSpan && `col:${cell.colSpan}`}
                              </span>
                            </div>
                          )}

                          <div className="whitespace-pre-wrap break-words leading-relaxed min-h-[1.2rem]">
                            {cell.text || (
                              <span className="text-stone-300 italic text-[11px]">
                                (빈 셀)
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
