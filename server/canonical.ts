import {
  CanonicalDocument,
  CanonicalDocumentStats,
  CanonicalOutlineNode,
  CanonicalPage,
  CanonicalQualityReport,
  CanonicalTable,
  CanonicalTableCell,
} from "../src/types.js";

/**
 * Text normalization strictly limited to:
 * - Line break normalization (CRLF -> LF)
 * - Trailing whitespace removal on each line
 * NO spelling correction, NO sentence splitting, NO character alteration.
 */
export function normalizeText(raw: string): string {
  if (!raw) return "";
  const lf = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = lf.split("\n");
  return lines.map((line) => line.trimEnd()).join("\n");
}

/**
 * Normalizes uploaded filenames against UTF-8/Latin1 multipart mojibake.
 * Multer/busboy sometimes interprets multipart UTF-8 headers as latin1.
 */
export function normalizeUploadFilename(name: string): string {
  if (!name) return "document";
  // UTF-8 bytes mistakenly interpreted as Latin-1 produce typical sequences with ì, ë, ê, í, or control chars \u0080-\u009F
  const looksMojibake = /[ìëêí]|[\u0080-\u009F]/.test(name);
  if (!looksMojibake) {
    return name.normalize("NFC");
  }
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    if (decoded.includes("\uFFFD")) {
      return name.normalize("NFC");
    }
    return decoded.normalize("NFC");
  } catch {
    return name.normalize("NFC");
  }
}

/**
 * Build Canonical Pages from raw export-text result.
 */
export function buildCanonicalPages(textData: any): {
  pages: CanonicalPage[];
  totalCharCount: number;
} {
  const pages: CanonicalPage[] = [];
  let totalCharCount = 0;

  if (!textData || !Array.isArray(textData.pages)) {
    return { pages, totalCharCount };
  }

  for (let i = 0; i < textData.pages.length; i++) {
    const rawPage = textData.pages[i];
    const pageIndex = typeof rawPage.page === "number" ? rawPage.page : i;
    const rawText = typeof rawPage.text === "string" ? rawPage.text : "";
    const cleanText = normalizeText(rawText);
    const charCount = rawText.length;

    totalCharCount += charCount;

    pages.push({
      page: pageIndex,
      display_page: pageIndex + 1,
      text: cleanText,
      char_count: charCount,
    });
  }

  return { pages, totalCharCount };
}

/**
 * Build Canonical Tables from raw export-tables result.
 * Preserves row, col, row_span, col_span, is_header, text, and nested tables.
 */
export function buildCanonicalTables(tablesData: any): {
  tables: CanonicalTable[];
  totalCellCount: number;
  mergedCellCount: number;
  nestedTableCount: number;
} {
  const tables: CanonicalTable[] = [];
  let totalCellCount = 0;
  let mergedCellCount = 0;
  let nestedTableCount = 0;

  const rawTables = Array.isArray(tablesData?.tables)
    ? tablesData.tables
    : Array.isArray(tablesData)
    ? tablesData
    : [];

  for (let tIdx = 0; tIdx < rawTables.length; tIdx++) {
    const rawT = rawTables[tIdx];
    const tableIndex = typeof rawT.index === "number" ? rawT.index : tIdx;
    const tableId = `table_${tableIndex + 1}`;

    const rawCells = Array.isArray(rawT.cells) ? rawT.cells : [];
    const cells: CanonicalTableCell[] = [];

    let maxRow = typeof rawT.rows === "number" ? rawT.rows : (rawT.rowCount ?? 0);
    let maxCol = typeof rawT.cols === "number" ? rawT.cols : (rawT.colCount ?? 0);

    for (let cIdx = 0; cIdx < rawCells.length; cIdx++) {
      const rawC = rawCells[cIdx];
      const row = typeof rawC.row === "number" ? rawC.row : 0;
      const col = typeof rawC.col === "number" ? rawC.col : 0;
      const rowSpan = rawC.rowSpan ?? rawC.row_span ?? 1;
      const colSpan = rawC.colSpan ?? rawC.col_span ?? 1;
      const isHeader = Boolean(rawC.isHeader ?? rawC.is_header ?? false);
      const cellText = normalizeText(rawC.text ?? "");

      if (row + rowSpan > maxRow) maxRow = row + rowSpan;
      if (col + colSpan > maxCol) maxCol = col + colSpan;

      if (rowSpan > 1 || colSpan > 1) {
        mergedCellCount++;
      }

      // Handle nested tables recursively if present
      let nested: CanonicalTable[] | undefined;
      const rawNested = rawC.nested ?? rawC.nestedTables ?? rawC.tables;
      if (Array.isArray(rawNested) && rawNested.length > 0) {
        const sub = buildCanonicalTables({ tables: rawNested });
        nested = sub.tables;
        nestedTableCount += sub.tables.length + sub.nestedTableCount;
        totalCellCount += sub.totalCellCount;
        mergedCellCount += sub.mergedCellCount;
      }

      totalCellCount++;

      cells.push({
        row,
        col,
        row_span: rowSpan,
        col_span: colSpan,
        is_header: isHeader,
        text: cellText,
        ...(nested && nested.length > 0 ? { nested } : {}),
      });
    }

    tables.push({
      id: tableId,
      index: tableIndex,
      source_locator: {
        section: rawT.section ?? null,
        paragraph: rawT.paragraph ?? null,
      },
      caption: rawT.caption ?? null,
      rows: maxRow,
      cols: maxCol,
      cell_count: cells.length,
      cells,
    });
  }

  return { tables, totalCellCount, mergedCellCount, nestedTableCount };
}

/**
 * Build Canonical Outline hierarchy from raw export-structure result.
 * Supports rhwp export-structure schema:
 * roots[] has { kind, level, marker, heading, body[], children[], section, paragraph }
 * As well as generic { title, text, label, number, children, subnodes } schemas.
 */
export function buildCanonicalOutline(structureData: any): {
  outline: CanonicalOutlineNode[];
  nodeCount: number;
} {
  let nodeCount = 0;

  function convertNode(raw: any, fallbackIdx: number): CanonicalOutlineNode {
    nodeCount++;
    const id = raw.id ? String(raw.id) : `outline_${nodeCount}`;
    const level = typeof raw.level === "number" ? raw.level : 1;

    // rhwp export-structure attributes:
    // - heading: The actual heading text (e.g., "과업명", "제안요청 내역")
    // - marker: Bullet/clause numeral (e.g., "Ⅰ.", "1.", "가.", "제1조")
    // - kind: Clause kind (e.g., "편", "장", "절", "관", "조", "항", "호", "목")
    // - paragraph: Paragraph index in document
    // - section: Section index in document
    // - body: Paragraph bodies under this clause
    const rawHeading = String(raw.heading ?? raw.title ?? raw.text ?? raw.label ?? raw.name ?? "").trim();
    const rawMarker = String(raw.marker ?? raw.number ?? "").trim();
    const kind = String(raw.kind ?? raw.type ?? "").trim();
    const paraIndex =
      typeof raw.paragraph === "number"
        ? raw.paragraph
        : typeof raw.paraIndex === "number"
        ? raw.paraIndex
        : typeof raw.para_index === "number"
        ? raw.para_index
        : null;
    const section =
      typeof raw.section === "number"
        ? raw.section
        : typeof raw.sectionIndex === "number"
        ? raw.sectionIndex
        : null;

    const body: string[] = Array.isArray(raw.body)
      ? raw.body.map((b: any) => String(b).trim()).filter(Boolean)
      : [];

    // Synthesize clean canonical title
    let title = rawHeading;
    if (rawMarker) {
      if (!title) {
        title = rawMarker;
      } else if (!title.startsWith(rawMarker)) {
        title = `${rawMarker} ${title}`.trim();
      }
    }
    if (!title && kind) {
      title = kind;
    }

    const rawChildren = Array.isArray(raw.children)
      ? raw.children
      : Array.isArray(raw.subnodes)
      ? raw.subnodes
      : Array.isArray(raw.items)
      ? raw.items
      : [];

    const children = rawChildren.map((c: any, i: number) => convertNode(c, i + 1));

    return {
      id,
      level,
      title,
      heading: rawHeading || undefined,
      marker: rawMarker || null,
      number: rawMarker || null,
      kind: kind || null,
      para_index: paraIndex,
      section,
      body: body.length > 0 ? body : undefined,
      children,
    };
  }

  const rawRoots =
    structureData?.structure?.roots ??
    structureData?.roots ??
    structureData?.structure?.nodes ??
    structureData?.nodes ??
    (Array.isArray(structureData) ? structureData : []);

  if (!Array.isArray(rawRoots) || rawRoots.length === 0) {
    return { outline: [], nodeCount: 0 };
  }

  const outline = rawRoots.map((r: any, i: number) => convertNode(r, i + 1));
  return { outline, nodeCount };
}

/**
 * Main Builder: Assembles CanonicalDocument from raw rhwp parse result.
 */
export function buildCanonicalDocument(parseResult: any): CanonicalDocument {
  const rawFileName = parseResult?.file?.name || "document";
  const fileName = normalizeUploadFilename(rawFileName);
  const rawFormat = String(parseResult?.file?.format || "").toLowerCase();
  const format: "hwp" | "hwpx" = rawFormat.includes("hwpx") ? "hwpx" : "hwp";
  const size = Number(parseResult?.file?.size || 0);
  const rhwpVersion = parseResult?.rhwp?.version || "rhwp 0.8.6";

  const info = parseResult?.info || {};
  const textData = parseResult?.text || {};
  const tablesData = parseResult?.tables || {};
  const structureData = parseResult?.structure || {};

  const warnings: string[] = [];

  // 1. Text pages
  const { pages, totalCharCount } = buildCanonicalPages(textData);

  // Check truncation and omission
  const truncated = Boolean(textData.truncated);
  const omittedCount = typeof textData.omittedCount === "number" ? textData.omittedCount : 0;

  if (truncated) {
    warnings.push("본문 추출 결과가 잘렸습니다. AI 분석에 사용하면 안 됩니다.");
  }
  if (omittedCount > 0) {
    warnings.push(`본문에서 ${omittedCount}개의 문자가 누락(생략)되었습니다.`);
  }
  if (pages.length === 0 || totalCharCount === 0) {
    warnings.push("추출된 본문 텍스트가 비어 있습니다.");
  }

  // Check raw info warnings
  if (Array.isArray(info.warnings)) {
    for (const w of info.warnings) {
      if (typeof w === "string" && !warnings.includes(w)) {
        warnings.push(w);
      }
    }
  }

  // 2. Tables
  const { tables, totalCellCount, mergedCellCount, nestedTableCount } = buildCanonicalTables(tablesData);

  // 3. Outline
  const { outline, nodeCount: outlineNodeCount } = buildCanonicalOutline(structureData);

  // 4. Metadata
  const pageCount =
    typeof info.pageCount === "number"
      ? info.pageCount
      : pages.length > 0
      ? pages.length
      : null;
  const paragraphCount = typeof info.paraCount === "number" ? info.paraCount : null;
  const sectionCount = typeof info.sections === "number" ? info.sections : null;
  const title = typeof info.title === "string" && info.title.trim() ? info.title.trim() : null;

  // 5. Stats
  const stats: CanonicalDocumentStats = {
    page_count: pages.length,
    total_char_count: totalCharCount,
    table_count: tables.length,
    total_cell_count: totalCellCount,
    merged_cell_count: mergedCellCount,
    nested_table_count: nestedTableCount,
    outline_node_count: outlineNodeCount,
    truncated,
    omitted_count: omittedCount,
    markdown_char_count: 0,
  };

  const doc: CanonicalDocument = {
    schema_version: "1.0",
    source: {
      file_name: fileName,
      format,
      size,
      rhwp_version: rhwpVersion,
    },
    metadata: {
      page_count: pageCount,
      paragraph_count: paragraphCount,
      section_count: sectionCount,
      title,
    },
    pages,
    tables,
    outline,
    stats,
    warnings,
  };

  return doc;
}

/**
 * Render a single CanonicalTable into Markdown with Source Markers and Merged Cell comments.
 */
function renderTableMarkdown(table: CanonicalTable): string {
  const parts: string[] = [];

  parts.push(`<!-- TABLE:${table.id} -->`);
  const sec = table.source_locator.section ?? "-";
  const para = table.source_locator.paragraph ?? "-";
  parts.push(`<!-- SOURCE table=${table.index + 1} section=${sec} paragraph=${para} -->`);
  parts.push(`<!-- SIZE: rows=${table.rows} cols=${table.cols} -->`);
  parts.push("");
  parts.push(`### [TABLE ${table.index + 1}]`);
  parts.push("");

  if (table.caption) {
    parts.push(`**캡션**: ${table.caption}\n`);
  }

  // Merged cell comments
  const mergedCells = table.cells.filter((c) => c.row_span > 1 || c.col_span > 1);
  if (mergedCells.length > 0) {
    for (const mc of mergedCells) {
      parts.push(
        `<!-- MERGED_CELL row=${mc.row} col=${mc.col} rowSpan=${mc.row_span} colSpan=${mc.col_span} -->`
      );
    }
    parts.push("");
  }

  // Build grid
  const rowCount = Math.max(table.rows, 1);
  const colCount = Math.max(table.cols, 1);
  const grid: string[][] = Array.from({ length: rowCount }, () =>
    Array(colCount).fill("")
  );

  // Track spanned locations
  const spanned = new Set<string>();

  for (const cell of table.cells) {
    const cleanText = cell.text
      .replace(/\r?\n/g, "<br>")
      .replace(/\|/g, "\\|")
      .trim();

    if (cell.row < rowCount && cell.col < colCount) {
      grid[cell.row][cell.col] = cleanText;
    }

    // Mark spanned cells in grid
    for (let r = cell.row; r < cell.row + cell.row_span; r++) {
      for (let c = cell.col; c < cell.col + cell.col_span; c++) {
        if (r === cell.row && c === cell.col) continue;
        if (r < rowCount && c < colCount) {
          spanned.add(`${r},${c}`);
          grid[r][c] = "(병합)";
        }
      }
    }
  }

  // Header row (row 0 or generic)
  const headerCells = grid[0].map((val, colIdx) => val || `열 ${colIdx + 1}`);
  parts.push(`| ${headerCells.join(" | ")} |`);
  parts.push(`| ${headerCells.map(() => "---").join(" | ")} |`);

  // Data rows (from row 1, or row 0 if table had 1 row)
  const startRow = rowCount > 1 ? 1 : 0;
  if (rowCount > 1) {
    for (let r = 1; r < rowCount; r++) {
      const rowValues = grid[r].map((val) => val || " ");
      parts.push(`| ${rowValues.join(" | ")} |`);
    }
  } else {
    // 1-row table: repeat row values in data row
    const rowValues = grid[0].map((val) => val || " ");
    parts.push(`| ${rowValues.join(" | ")} |`);
  }

  parts.push("");

  // Check nested tables
  for (const cell of table.cells) {
    if (cell.nested && cell.nested.length > 0) {
      for (const nTable of cell.nested) {
        parts.push(
          `<!-- NESTED_TABLE parent_cell=row${cell.row}_col${cell.col} table_id=${nTable.id} -->`
        );
        parts.push(renderTableMarkdown(nTable));
      }
    }
  }

  return parts.join("\n");
}

/**
 * Render Outline recursively
 */
function renderOutlineMarkdown(nodes: CanonicalOutlineNode[]): string {
  if (!nodes || nodes.length === 0) {
    return "<!-- EMPTY_OUTLINE -->\n(문서 개요/목차가 제공되지 않았습니다.)\n";
  }

  const lines: string[] = [];

  function walk(node: CanonicalOutlineNode, depth: number) {
    const indent = "  ".repeat(Math.max(0, depth));
    const pIdx = node.para_index !== null && node.para_index !== undefined ? node.para_index : "-";
    const secAttr = node.section !== null && node.section !== undefined ? ` sec=${node.section}` : "";
    const kindAttr = node.kind ? ` kind="${node.kind}"` : "";

    lines.push(
      `${indent}<!-- SOURCE outline=${node.id} paraIndex=${pIdx}${secAttr}${kindAttr} -->`
    );

    let displayTitle = (node.title || node.heading || "").trim();
    if (node.number && !displayTitle.startsWith(node.number)) {
      displayTitle = `${node.number} ${displayTitle}`.trim();
    }
    if (!displayTitle && node.kind) {
      displayTitle = `(${node.kind})`;
    }
    if (!displayTitle) {
      displayTitle = `(제목 없음 ${node.id})`;
    }

    lines.push(`${indent}- ${displayTitle}`);

    if (node.body && node.body.length > 0) {
      for (const b of node.body) {
        if (typeof b === "string" && b.trim()) {
          lines.push(`${indent}  > ${b.trim()}`);
        }
      }
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  for (const root of nodes) {
    walk(root, 0);
  }

  return lines.join("\n") + "\n";
}

/**
 * Build Canonical Markdown String from CanonicalDocument.
 * Strictly adheres to document layout:
 * 1. Metadata header
 * 2. # DOCUMENT TEXT (Page order, with Source Markers)
 * 3. # DOCUMENT OUTLINE (Hierarchical list, with Source Markers)
 * 4. # DOCUMENT TABLES (Original order, with Source Markers & Merged Cell comments)
 */
export function buildCanonicalMarkdown(doc: CanonicalDocument): string {
  const parts: string[] = [];

  // Header metadata
  parts.push("<!-- CANONICAL_DOCUMENT v1.0 -->");
  parts.push(`<!-- SOURCE: ${doc.source.file_name} -->`);
  parts.push(`<!-- RHWP_VERSION: ${doc.source.rhwp_version} -->`);
  parts.push("");
  parts.push("# 문서 메타정보");
  parts.push("");
  parts.push(`- 파일명: ${doc.source.file_name}`);
  parts.push(`- 문서 형식: ${doc.source.format.toUpperCase()}`);
  parts.push(`- 파일 크기: ${doc.source.size.toLocaleString()} bytes`);
  parts.push(`- 페이지 수: ${doc.metadata.page_count ?? "미지정"}`);
  parts.push(`- 문단 수: ${doc.metadata.paragraph_count ?? "미지정"}`);
  if (doc.metadata.title) {
    parts.push(`- 제목: ${doc.metadata.title}`);
  }
  parts.push("");
  parts.push("---");
  parts.push("");

  // Section 1: DOCUMENT TEXT
  parts.push("# DOCUMENT TEXT");
  parts.push("");

  if (doc.pages.length === 0) {
    parts.push("(추출된 본문 텍스트가 없습니다.)\n");
  } else {
    for (const page of doc.pages) {
      parts.push(`<!-- SOURCE page=${page.page} -->`);
      parts.push(`## [PAGE ${page.display_page}]`);
      parts.push("");
      parts.push(page.text || "(빈 페이지)");
      parts.push("");
    }
  }

  parts.push("---");
  parts.push("");

  // Section 2: DOCUMENT OUTLINE
  parts.push("# DOCUMENT OUTLINE");
  parts.push("");
  parts.push(renderOutlineMarkdown(doc.outline));
  parts.push("---");
  parts.push("");

  // Section 3: DOCUMENT TABLES
  parts.push("# DOCUMENT TABLES");
  parts.push("");

  if (doc.tables.length === 0) {
    parts.push("<!-- EMPTY_TABLES -->");
    parts.push("(문서에 추출된 표가 없습니다.)\n");
  } else {
    for (const table of doc.tables) {
      parts.push(renderTableMarkdown(table));
      parts.push("---");
      parts.push("");
    }
  }

  const markdownString = parts.join("\n");

  // Sync markdown char count to doc stats
  doc.stats.markdown_char_count = markdownString.length;

  return markdownString;
}

/**
 * Build Canonical Quality Report
 */
export function buildCanonicalQuality(
  parseResult: any,
  doc: CanonicalDocument,
  markdown: string
): CanonicalQualityReport {
  return {
    text: {
      page_count: doc.pages.length,
      char_count: doc.stats.total_char_count,
      truncated: doc.stats.truncated,
      omitted_count: doc.stats.omitted_count,
    },
    tables: {
      table_count: doc.tables.length,
      cell_count: doc.stats.total_cell_count,
      merged_cell_count: doc.stats.merged_cell_count,
      nested_table_count: doc.stats.nested_table_count,
    },
    structure: {
      node_count: doc.stats.outline_node_count,
    },
    canonical: {
      markdown_char_count: markdown.length,
      warnings: [...doc.warnings],
    },
  };
}
