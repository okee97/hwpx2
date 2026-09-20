import assert from "node:assert/strict";
import {
  buildCanonicalDocument,
  buildCanonicalMarkdown,
  buildCanonicalQuality,
  normalizeText,
} from "../server/canonical.ts";

console.log("==================================================");
console.log("[TEST] Canonical Document Builder 단위/통합 테스트 (10개 시나리오)");
console.log("==================================================");

let passedCount = 0;
let failedCount = 0;

function runTest(testName: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ [PASS] ${testName}`);
    passedCount++;
  } catch (err: any) {
    console.error(`✗ [FAIL] ${testName}:`, err.message);
    failedCount++;
  }
}

// TEST 1: export-text 3페이지
runTest("TEST 1: export-text 3페이지 (순서 및 모든 원문 보존)", () => {
  const mock = {
    file: { name: "test_doc.hwp", format: "hwp", size: 1024 },
    rhwp: { version: "rhwp 0.8.6" },
    text: {
      pageCount: 3,
      pages: [
        { page: 0, text: "제1쪽 머리글\n사업명 : 디지털 전환 사업" },
        { page: 1, text: "제2쪽 본문\n1. 과업 범위 및 목표" },
        { page: 2, text: "제3쪽 결언\n제안서 제출 마감 : 2026-10-31" },
      ],
      truncated: false,
      omittedCount: 0,
    },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.equal(doc.pages.length, 3, "페이지 수는 3이어야 함");
  assert.equal(doc.pages[0].page, 0);
  assert.equal(doc.pages[0].display_page, 1);
  assert.equal(doc.pages[1].display_page, 2);
  assert.equal(doc.pages[2].display_page, 3);
  assert.match(doc.pages[0].text, /사업명 : 디지털 전환 사업/);
  assert.match(doc.pages[1].text, /과업 범위 및 목표/);
  assert.match(doc.pages[2].text, /2026-10-31/);

  assert.match(md, /<!-- SOURCE page=0 -->/);
  assert.match(md, /## \[PAGE 1\]/);
  assert.match(md, /## \[PAGE 2\]/);
  assert.match(md, /## \[PAGE 3\]/);
});

// TEST 2: 일반 3×3 표
runTest("TEST 2: 일반 3×3 표 (rows/cols/cells 구조 보존)", () => {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push({
        row: r,
        col: c,
        rowSpan: 1,
        colSpan: 1,
        isHeader: r === 0,
        text: `셀 R${r}C${c}`,
      });
    }
  }

  const mock = {
    file: { name: "table_test.hwp" },
    tables: {
      tables: [
        {
          index: 0,
          rows: 3,
          cols: 3,
          section: 1,
          paragraph: 10,
          caption: "기본 3x3 표",
          cells,
        },
      ],
    },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.equal(doc.tables.length, 1);
  const table = doc.tables[0];
  assert.equal(table.rows, 3);
  assert.equal(table.cols, 3);
  assert.equal(table.cell_count, 9);
  assert.equal(table.cells[0].is_header, true);
  assert.equal(table.cells[4].text, "셀 R1C1");

  assert.match(md, /<!-- TABLE:table_1 -->/);
  assert.match(md, /<!-- SIZE: rows=3 cols=3 -->/);
  assert.match(md, /셀 R0C0/);
});

// TEST 3: colSpan=3 병합셀
runTest("TEST 3: colSpan=3 병합셀 (Canonical JSON에서 col_span=3 유지)", () => {
  const mock = {
    file: { name: "colspan_test.hwp" },
    tables: {
      tables: [
        {
          index: 0,
          rows: 2,
          cols: 3,
          cells: [
            { row: 0, col: 0, rowSpan: 1, colSpan: 3, text: "제목 전체 병합셀" },
            { row: 1, col: 0, rowSpan: 1, colSpan: 1, text: "A" },
            { row: 1, col: 1, rowSpan: 1, colSpan: 1, text: "B" },
            { row: 1, col: 2, rowSpan: 1, colSpan: 1, text: "C" },
          ],
        },
      ],
    },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.equal(doc.tables[0].cells[0].col_span, 3);
  assert.equal(doc.stats.merged_cell_count, 1);
  assert.match(md, /<!-- MERGED_CELL row=0 col=0 rowSpan=1 colSpan=3 -->/);
});

// TEST 4: rowSpan=2 병합셀
runTest("TEST 4: rowSpan=2 병합셀 (Canonical JSON에서 row_span=2 유지)", () => {
  const mock = {
    file: { name: "rowspan_test.hwp" },
    tables: {
      tables: [
        {
          index: 1,
          rows: 2,
          cols: 2,
          cells: [
            { row: 0, col: 0, rowSpan: 2, colSpan: 1, text: "세로 2칸 병합" },
            { row: 0, col: 1, rowSpan: 1, colSpan: 1, text: "오른쪽 상단" },
            { row: 1, col: 1, rowSpan: 1, colSpan: 1, text: "오른쪽 하단" },
          ],
        },
      ],
    },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.equal(doc.tables[0].cells[0].row_span, 2);
  assert.match(md, /<!-- MERGED_CELL row=0 col=0 rowSpan=2 colSpan=1 -->/);
});

// TEST 5: 중첩표 (Nested Table)
runTest("TEST 5: 중첩표 (nested 정보 및 자식 표 보존)", () => {
  const mock = {
    file: { name: "nested_test.hwp" },
    tables: {
      tables: [
        {
          index: 0,
          rows: 1,
          cols: 1,
          cells: [
            {
              row: 0,
              col: 0,
              rowSpan: 1,
              colSpan: 1,
              text: "상위 표 셀",
              nested: [
                {
                  index: 10,
                  rows: 2,
                  cols: 1,
                  cells: [
                    { row: 0, col: 0, rowSpan: 1, colSpan: 1, text: "중첩 자식 1" },
                    { row: 1, col: 0, rowSpan: 1, colSpan: 1, text: "중첩 자식 2" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert(doc.tables[0].cells[0].nested, "nested array가 존재해야 함");
  assert.equal(doc.tables[0].cells[0].nested!.length, 1);
  assert.equal(doc.tables[0].cells[0].nested![0].cells[0].text, "중첩 자식 1");
  assert.equal(doc.stats.nested_table_count, 1);
  assert.match(md, /<!-- NESTED_TABLE parent_cell=row0_col0 table_id=table_11 -->/);
});

// TEST 6: export-text.truncated=true
runTest("TEST 6: export-text.truncated=true (품질 경고 생성)", () => {
  const mock = {
    file: { name: "truncated.hwp" },
    text: {
      pageCount: 1,
      truncated: true,
      omittedCount: 1500,
      pages: [{ page: 0, text: "일부만 추출된 텍스트..." }],
    },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);
  const quality = buildCanonicalQuality(mock, doc, md);

  assert.equal(doc.stats.truncated, true);
  assert.equal(doc.stats.omitted_count, 1500);
  assert(
    doc.warnings.some((w) => w.includes("본문 추출 결과가 잘렸습니다")),
    "본문 잘림 경고가 포함되어야 함"
  );
  assert(
    quality.canonical.warnings.some((w) => w.includes("본문 추출 결과가 잘렸습니다")),
    "Quality report에도 경고가 반영되어야 함"
  );
});

// TEST 7: 빈 structure (에러 없음, outline=[])
runTest("TEST 7: 빈 structure (오류 없이 outline=[] 및 정보 유지)", () => {
  const mock = {
    file: { name: "empty_structure.hwp" },
    structure: {
      nodeCount: 0,
      structure: { roots: [] },
    },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.deepEqual(doc.outline, []);
  assert.equal(doc.stats.outline_node_count, 0);
  assert.match(md, /<!-- EMPTY_OUTLINE -->/);
  assert.match(md, /문서 개요\/목차가 제공되지 않았습니다/);
});

// TEST 8: 표 없음 (tables=[])
runTest("TEST 8: 표 없음 (tables=[] 정상 Canonical 생성)", () => {
  const mock = {
    file: { name: "no_tables.hwp" },
    text: { pages: [{ page: 0, text: "표가 없는 단순 본문 문서" }] },
    tables: { tableCount: 0, tables: [] },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.deepEqual(doc.tables, []);
  assert.equal(doc.stats.table_count, 0);
  assert.match(md, /<!-- EMPTY_TABLES -->/);
  assert.match(md, /문서에 추출된 표가 없습니다/);
});

// TEST 9: 특수문자/금액 불변성
runTest("TEST 9: 특수문자/금액 원문 보존성 ('금1,234,567,890원(VAT 포함)')", () => {
  const originalBudget = "사업예산 : 금1,234,567,890원(VAT 포함) [단, ₩ & $ % ^ * 포함]";
  const mock = {
    file: { name: "budget.hwp" },
    text: {
      pages: [{ page: 0, text: originalBudget }],
    },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.equal(doc.pages[0].text, originalBudget);
  assert(md.includes(originalBudget), "Markdown에도 금액 및 특수문자가 100% 동일하게 보존되어야 함");
});

// TEST 10: 빈 문서 또는 파싱 실패 데이터 (가짜 본문 생성 금지, 명확한 경고)
runTest("TEST 10: 빈 문서 (가짜 본문 생성 금지 및 명확한 warning)", () => {
  const mock = {
    file: { name: "empty.hwp" },
    text: null,
    tables: null,
    structure: null,
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.equal(doc.pages.length, 0);
  assert.equal(doc.tables.length, 0);
  assert.equal(doc.outline.length, 0);
  assert(
    doc.warnings.some((w) => w.includes("본문 텍스트가 비어 있습니다")),
    "본문 비어있음 경고가 생성되어야 함"
  );
  assert.match(md, /추출된 본문 텍스트가 없습니다/);
});

// TEST 11: 파일명 한글 인코딩 깨짐 (Mojibake) 복원
runTest("TEST 11: 파일명 Mojibake 복원 (latin1 -> UTF-8 정규화)", () => {
  const originalKorean = "[제안요청서] 우수제품 제3자단가계약 품목 적정성 실태조사 용역.hwpx";
  // Simulate Multer UTF-8 bytes misinterpreted as latin1
  const mojibakeName = Buffer.from(originalKorean, "utf8").toString("latin1");

  const mock = {
    file: { name: mojibakeName, format: "hwpx" },
    text: { pages: [{ page: 0, text: "테스트" }] },
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.equal(doc.source.file_name, originalKorean, "깨진 파일명이 원본 한글로 복구되어야 함");
  assert.match(md, /우수제품 제3자단가계약/, "Markdown 메타정보 헤더에도 정상 한글 파일명이 기록되어야 함");
});

// TEST 12: rhwp export-structure의 heading/marker/paragraph 계층 변환 및 빈 제목 방지
runTest("TEST 12: rhwp export-structure 계층 변환 (heading/marker/kind/paragraph 반영 및 빈 제목 방지)", () => {
  const mockStructure = {
    mode: "clause",
    nodeCount: 3,
    structure: {
      roots: [
        {
          kind: "조",
          level: 1,
          marker: "Ⅰ.",
          heading: "제안요청 내역",
          paragraph: 79,
          children: [
            {
              kind: "항",
              level: 2,
              marker: "1.",
              heading: "과업명",
              paragraph: 94,
              body: ["우수제품 제3자단가계약 품목 적정성 실태조사 용역"],
              children: [],
            },
            {
              kind: "항",
              level: 2,
              marker: "2.",
              heading: "과업 목적 및 필요성",
              paragraph: 102,
              children: [],
            },
          ],
        },
      ],
    },
  };

  const mock = {
    file: { name: "test_outline.hwpx", format: "hwpx" },
    text: { pages: [{ page: 0, text: "개요 테스트" }] },
    structure: mockStructure,
  };

  const doc = buildCanonicalDocument(mock);
  const md = buildCanonicalMarkdown(doc);

  assert.equal(doc.outline.length, 1);
  assert.equal(doc.stats.outline_node_count, 3);
  assert.equal(doc.outline[0].title, "Ⅰ. 제안요청 내역");
  assert.equal(doc.outline[0].para_index, 79);
  assert.equal(doc.outline[0].children![0].title, "1. 과업명");
  assert.equal(doc.outline[0].children![0].para_index, 94);

  // Verify Markdown output does not have empty `- ` lines
  assert(!md.includes("\n- \n"), "빈 제목 라인(- )이 존재해서는 안 됨");
  assert.match(md, /<!-- SOURCE outline=outline_1 paraIndex=79 kind="조" -->/);
  assert.match(md, /- Ⅰ\. 제안요청 내역/);
  assert.match(md, /<!-- SOURCE outline=outline_2 paraIndex=94 kind="항" -->/);
  assert.match(md, /  - 1\. 과업명/);
  assert.match(md, /  > 우수제품 제3자단가계약 품목 적정성 실태조사 용역/);
});

console.log("==================================================");
console.log(`테스트 결과: 총 ${passedCount + failedCount}개 중 통과 ${passedCount}개, 실패 ${failedCount}개`);
console.log("==================================================");

if (failedCount > 0) {
  process.exit(1);
}
