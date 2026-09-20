import React, { useState, useMemo } from "react";
import {
  FileText,
  FileCode,
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Search,
  ExternalLink,
  Layers,
  Table as TableIcon,
  AlignLeft,
  FileSpreadsheet,
  ListTree,
} from "lucide-react";
import {
  CanonicalDocument,
  CanonicalOutlineNode,
  CanonicalQualityReport,
} from "../types";
import { BusinessMetadataCard } from "./BusinessMetadataCard";

interface CanonicalDocumentTabProps {
  canonical: CanonicalDocument | null | undefined;
  markdown: string | null | undefined;
  quality: CanonicalQualityReport | null | undefined;
}

type SubTab = "markdown" | "json";

export function CanonicalDocumentTab({
  canonical,
  markdown,
  quality,
}: CanonicalDocumentTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("markdown");
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"raw" | "rendered">("raw");

  const markdownContent = markdown || "";
  const jsonContent = useMemo(() => {
    return canonical ? JSON.stringify(canonical, null, 2) : "";
  }, [canonical]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!canonical || !quality) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-stone-700">
          Canonical Document가 생성되지 않았습니다.
        </p>
        <p className="text-xs text-stone-500 mt-1">
          파일을 업로드하거나 샘플 파싱을 실행해주세요.
        </p>
      </div>
    );
  }

  const baseFileName = canonical.source.file_name.replace(/\.[^/.]+$/, "");
  const hasWarnings = quality.canonical.warnings.length > 0;
  const isTruncated = quality.text.truncated;

  return (
    <div className="space-y-6">
      {/* 1. AI Business Metadata Extraction Card */}
      <BusinessMetadataCard canonicalMarkdown={markdownContent} />

      {/* 2. Canonical Document Quality & Viewer Card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isTruncated
                  ? "bg-red-100 text-red-700"
                  : hasWarnings
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isTruncated || hasWarnings ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900">
                  Canonical Document (v{canonical.schema_version})
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-stone-200 text-stone-700 font-medium">
                  {canonical.source.format.toUpperCase()}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-stone-100 text-stone-600 border border-stone-200">
                  {canonical.source.rhwp_version}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                AI/LLM 없이 rhwp 원본 출력을 100% 무손실로 구조화한 표준 정규 문서
              </p>
            </div>
          </div>

          {/* Download & Copy Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-download-canonical-md"
              onClick={() =>
                handleDownload(
                  markdownContent,
                  `${baseFileName}_canonical.md`,
                  "text/markdown;charset=utf-8"
                )
              }
              className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>canonical.md 저장</span>
            </button>

            <button
              type="button"
              id="btn-download-canonical-json"
              onClick={() =>
                handleDownload(
                  jsonContent,
                  `${baseFileName}_canonical.json`,
                  "application/json;charset=utf-8"
                )
              }
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileCode className="w-3.5 h-3.5 text-stone-600" />
              <span>canonical.json 저장</span>
            </button>

            <button
              type="button"
              id="btn-copy-canonical"
              onClick={() =>
                handleCopy(subTab === "markdown" ? markdownContent : jsonContent)
              }
              className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{subTab === "markdown" ? "MD 복사" : "JSON 복사"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quality Metrics Grid */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs border-b border-stone-100">
          <div className="bg-stone-50/60 p-3 rounded-lg border border-stone-100">
            <span className="text-stone-500 block text-[11px] mb-1 flex items-center gap-1">
              <AlignLeft className="w-3 h-3 text-stone-400" /> 본문 텍스트
            </span>
            <div className="font-semibold text-stone-900 text-sm">
              {quality.text.page_count}쪽
            </div>
            <div className="text-[11px] text-stone-500 font-mono mt-0.5">
              {quality.text.char_count.toLocaleString()}자
            </div>
          </div>

          <div className="bg-stone-50/60 p-3 rounded-lg border border-stone-100">
            <span className="text-stone-500 block text-[11px] mb-1 flex items-center gap-1">
              <TableIcon className="w-3 h-3 text-stone-400" /> 추출 표
            </span>
            <div className="font-semibold text-stone-900 text-sm">
              {quality.tables.table_count}개
            </div>
            <div className="text-[11px] text-stone-500 font-mono mt-0.5">
              {quality.tables.cell_count.toLocaleString()}셀
            </div>
          </div>

          <div className="bg-stone-50/60 p-3 rounded-lg border border-stone-100">
            <span className="text-stone-500 block text-[11px] mb-1 flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3 text-stone-400" /> 병합 / 중첩표
            </span>
            <div className="font-semibold text-stone-900 text-sm">
              병합 {quality.tables.merged_cell_count}개
            </div>
            <div className="text-[11px] text-stone-500 font-mono mt-0.5">
              중첩표 {quality.tables.nested_table_count}개
            </div>
          </div>

          <div className="bg-stone-50/60 p-3 rounded-lg border border-stone-100">
            <span className="text-stone-500 block text-[11px] mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3 text-stone-400" /> 문서 개요 구조
            </span>
            <div className="font-semibold text-stone-900 text-sm">
              {quality.structure.node_count}개 노드
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              {quality.structure.node_count > 0 ? "계층 트리 보존" : "목차 없음"}
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border ${
              isTruncated
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-stone-50/60 border-stone-100"
            }`}
          >
            <span className="text-stone-500 block text-[11px] mb-1">
              본문 잘림 여부
            </span>
            <div
              className={`font-semibold text-sm ${
                isTruncated ? "text-red-600 font-bold" : "text-emerald-700"
              }`}
            >
              {isTruncated ? "잘림 발생" : "없음 (정상)"}
            </div>
            <div className="text-[11px] text-stone-500 mt-0.5">
              누락 {quality.text.omitted_count}자
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border ${
              hasWarnings
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-stone-50/60 border-stone-100"
            }`}
          >
            <span className="text-stone-500 block text-[11px] mb-1">
              품질 경고
            </span>
            <div
              className={`font-semibold text-sm ${
                hasWarnings ? "text-amber-700 font-bold" : "text-stone-700"
              }`}
            >
              {hasWarnings ? `${quality.canonical.warnings.length}건 감지` : "없음"}
            </div>
            <div className="text-[11px] text-stone-500 font-mono mt-0.5">
              MD {quality.canonical.markdown_char_count.toLocaleString()}자
            </div>
          </div>
        </div>

        {/* Warning Details Banner if any */}
        {hasWarnings && (
          <div className="p-4 bg-amber-50/80 border-b border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Canonical Document 품질 경고 내역:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1 text-amber-800">
              {quality.canonical.warnings.map((w, idx) => (
                <li key={idx} className="leading-relaxed">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sub-Tab Navigation Bar */}
        <div className="px-5 py-3 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
            <button
              type="button"
              id="subtab-canonical-markdown"
              onClick={() => setSubTab("markdown")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === "markdown"
                  ? "bg-white text-stone-900 font-bold shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Canonical Markdown (canonical.md)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-stone-200/80 text-stone-700">
                {markdownContent.length.toLocaleString()}자
              </span>
            </button>

            <button
              type="button"
              id="subtab-canonical-json"
              onClick={() => setSubTab("json")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === "json"
                  ? "bg-white text-stone-900 font-bold shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Canonical JSON (canonical.json)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-stone-200/80 text-stone-700">
                v{canonical.schema_version}
              </span>
            </button>
          </div>

          {/* View Mode Toggle (for Markdown) or Search */}
          <div className="flex items-center gap-3">
            {subTab === "markdown" && (
              <div className="flex items-center gap-1 text-xs border border-stone-200 rounded-md p-0.5 bg-stone-50">
                <button
                  type="button"
                  onClick={() => setPreviewMode("raw")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    previewMode === "raw"
                      ? "bg-white shadow-2xs font-semibold text-stone-900"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  원문 소스 (LLM 프롬프트용)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("rendered")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    previewMode === "rendered"
                      ? "bg-white shadow-2xs font-semibold text-stone-900"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  구조화 뷰
                </button>
              </div>
            )}

            {/* In-view Search Filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="문서 내용 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs bg-stone-50 border border-stone-200 rounded-md focus:outline-hidden focus:border-stone-400 w-44"
              />
            </div>
          </div>
        </div>

        {/* Sub-Tab Content View */}
        <div className="p-5">
          {subTab === "markdown" && (
            <div>
              {previewMode === "raw" ? (
                <div className="relative">
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                    <span className="text-[11px] text-stone-400 font-mono">
                      UTF-8 • {markdownContent.split("\n").length.toLocaleString()} lines
                    </span>
                  </div>
                  <pre
                    id="canonical-markdown-raw"
                    className="font-mono text-xs p-5 bg-stone-950 text-stone-100 rounded-lg overflow-x-auto whitespace-pre-wrap select-text leading-relaxed max-h-[650px] border border-stone-800"
                  >
                    {markdownContent}
                  </pre>
                </div>
              ) : (
                <div className="p-6 bg-stone-50/60 rounded-lg border border-stone-200 max-h-[650px] overflow-y-auto space-y-6">
                  {/* Metadata block */}
                  <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-2xs">
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">
                      문서 메타정보
                    </h4>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <dt className="text-stone-500">파일명</dt>
                        <dd className="font-semibold text-stone-900 truncate">
                          {canonical.source.file_name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">페이지 수</dt>
                        <dd className="font-semibold text-stone-900 font-mono">
                          {canonical.metadata.page_count ?? "-"}쪽
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">문단 수</dt>
                        <dd className="font-semibold text-stone-900 font-mono">
                          {canonical.metadata.paragraph_count ?? "-"}문단
                        </dd>
                      </div>
                      <div>
                        <dt className="text-stone-500">포맷 / 버전</dt>
                        <dd className="font-semibold text-stone-900 font-mono">
                          {canonical.source.format.toUpperCase()} (
                          {canonical.source.rhwp_version})
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Document Text section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-stone-600" />
                      <span>DOCUMENT TEXT ({canonical.pages.length} Pages)</span>
                    </h4>
                    {canonical.pages.map((p) => (
                      <div
                        key={p.page}
                        className="bg-white p-4 rounded-lg border border-stone-200 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs border-b border-stone-100 pb-2">
                          <span className="font-bold text-stone-800">
                            [PAGE {p.display_page}]
                          </span>
                          <span className="font-mono text-stone-400 text-[11px]">
                            Source: page={p.page} • {p.char_count.toLocaleString()}자
                          </span>
                        </div>
                        <pre className="text-xs text-stone-800 whitespace-pre-wrap font-sans leading-relaxed">
                          {p.text || "(빈 페이지)"}
                        </pre>
                      </div>
                    ))}
                  </div>

                  {/* Document Outline section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <ListTree className="w-4 h-4 text-stone-600" />
                      <span>
                        DOCUMENT OUTLINE ({canonical.outline.length} Root Nodes)
                      </span>
                    </h4>
                    {canonical.outline.length === 0 ? (
                      <div className="p-4 bg-white rounded-lg border border-stone-200 text-xs text-stone-500 italic">
                        (문서 개요/목차가 제공되지 않았습니다.)
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-lg border border-stone-200">
                        {function renderTree(nodes: CanonicalOutlineNode[], depth = 0) {
                          return (
                            <div
                              className={`space-y-1 ${
                                depth > 0 ? "pl-5 border-l border-stone-200 ml-2 mt-1" : ""
                              }`}
                            >
                              {nodes.map((node) => {
                                let display = (node.title || node.heading || "").trim();
                                if (node.number && !display.startsWith(node.number)) {
                                  display = `${node.number} ${display}`.trim();
                                }
                                if (!display && node.kind) {
                                  display = `(${node.kind})`;
                                }
                                if (!display) {
                                  display = `(제목 없음 ${node.id})`;
                                }

                                return (
                                  <div key={node.id} className="text-xs">
                                    <div className="flex flex-wrap items-center gap-1.5 py-1 text-stone-800">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                      {node.level !== undefined && (
                                        <span className="px-1 py-0.2 rounded bg-stone-100 font-mono text-[10px] text-stone-600">
                                          L{node.level}
                                        </span>
                                      )}
                                      {node.kind && (
                                        <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-200/60">
                                          {node.kind}
                                        </span>
                                      )}
                                      <span className="font-medium text-stone-900 break-words">
                                        {display}
                                      </span>
                                      {node.para_index !== null &&
                                        node.para_index !== undefined && (
                                          <span className="font-mono text-stone-400 text-[10px]">
                                            (para #{node.para_index})
                                          </span>
                                        )}
                                    </div>
                                    {node.body && node.body.length > 0 && (
                                      <div className="pl-4 ml-1 border-l border-stone-200 text-[11px] text-stone-600 italic py-0.5 space-y-0.5">
                                        {node.body.map((b, idx) => (
                                          <p key={idx} className="leading-relaxed">
                                            › {b}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                    {node.children && node.children.length > 0 && (
                                      renderTree(node.children, depth + 1)
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }(canonical.outline)}
                      </div>
                    )}
                  </div>

                  {/* Document Tables section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-stone-600" />
                      <span>DOCUMENT TABLES ({canonical.tables.length} Tables)</span>
                    </h4>
                    {canonical.tables.map((t) => (
                      <div
                        key={t.id}
                        className="bg-white p-4 rounded-lg border border-stone-200 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs border-b border-stone-100 pb-2">
                          <span className="font-bold text-stone-800">
                            [TABLE {t.index + 1}] {t.caption ? `- ${t.caption}` : ""}
                          </span>
                          <span className="font-mono text-stone-400 text-[11px]">
                            {t.rows}행 × {t.cols}열 • {t.cell_count}셀 (sec=
                            {t.source_locator.section ?? "-"} para=
                            {t.source_locator.paragraph ?? "-"})
                          </span>
                        </div>
                        <div className="text-xs text-stone-600">
                          {t.cells.some((c) => c.row_span > 1 || c.col_span > 1) && (
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] font-medium mr-2 mb-2">
                              병합 셀 포함 (JSON/MD 구조 주석 보존)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {subTab === "json" && (
            <div className="relative">
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                <span className="text-[11px] text-stone-400 font-mono">
                  Schema v1.0 • {jsonContent.length.toLocaleString()} bytes
                </span>
              </div>
              <pre
                id="canonical-json-raw"
                className="font-mono text-xs p-5 bg-stone-950 text-emerald-400 rounded-lg overflow-x-auto whitespace-pre select-text leading-relaxed max-h-[650px] border border-stone-800"
              >
                {jsonContent}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
