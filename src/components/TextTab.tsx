import React, { useState } from "react";
import { Copy, Check, Search, FileText, AlertCircle, BookOpen } from "lucide-react";
import { RhwpTextData } from "../types";

interface TextTabProps {
  textData: RhwpTextData | null;
}

export const TextTab: React.FC<TextTabProps> = ({ textData }) => {
  const [copied, setCopied] = useState(false);
  const [copiedPage, setCopiedPage] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPage, setSelectedPage] = useState<number | "all">("all");

  if (!textData) {
    return (
      <div className="p-12 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
        <AlertCircle className="w-10 h-10 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-stone-800 mb-1">
          텍스트 데이터가 없습니다
        </h3>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          rhwp export-text 명령이 실행되지 않았거나 결과가 비어 있습니다.
          실패한 경우 상단의 CLI 실행 내역을 확인해주세요.
        </p>
      </div>
    );
  }

  const pages = textData.pages || [];
  const pageCount = textData.pageCount ?? pages.length;

  const totalChars = pages.reduce((acc, p) => acc + (p.text?.length || 0), 0);

  const filteredPages = pages.filter((p) => {
    if (selectedPage !== "all" && p.page !== selectedPage) return false;
    if (!searchTerm.trim()) return true;
    return p.text.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleCopyAll = () => {
    const fullText = pages
      .map((p) => `--- Page ${p.page + 1} ---\n${p.text}`)
      .join("\n\n");
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPage = (pageNum: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPage(pageNum);
    setTimeout(() => setCopiedPage(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <BookOpen className="w-4 h-4 text-stone-500" />
            <span>총 페이지: <strong className="font-semibold text-stone-900">{pageCount}</strong></span>
            <span className="text-stone-300">•</span>
            <span>총 글자 수: <strong className="font-semibold text-stone-900">{totalChars.toLocaleString()}자</strong></span>
            {textData.truncated && (
              <>
                <span className="text-stone-300">•</span>
                <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  문자 상한으로 잘림 (생략 {textData.omittedCount || 0}자)
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Page Filter dropdown */}
          <select
            id="select-page-filter"
            aria-label="페이지 선택 필터"
            value={selectedPage}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedPage(val === "all" ? "all" : parseInt(val, 10));
            }}
            className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 font-medium focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            <option value="all">전체 페이지 보기 ({pages.length}쪽)</option>
            {pages.map((p) => (
              <option key={p.page} value={p.page}>
                Page {p.page + 1}
              </option>
            ))}
          </select>

          {/* Search in text */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="텍스트 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 w-36 sm:w-48"
            />
          </div>

          {/* Copy all button */}
          <button
            id="btn-copy-all-text"
            type="button"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "복사 완료" : "전체 복사"}</span>
          </button>
        </div>
      </div>

      {/* Page List */}
      {filteredPages.length === 0 ? (
        <div className="p-8 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
          검색 조건과 일치하는 텍스트가 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPages.map((page) => {
            const pageNum = page.page + 1;
            const isEmptyText = !page.text || page.text.trim().length === 0;

            return (
              <div
                key={page.page}
                id={`text-page-${pageNum}`}
                className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden"
              >
                {/* Page Header */}
                <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-stone-900 px-2 py-0.5 bg-stone-200 rounded">
                      Page {pageNum}
                    </span>
                    <span className="text-xs text-stone-500">
                      {page.text?.length.toLocaleString() || 0} 자
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyPage(pageNum, page.text)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-stone-600 hover:text-stone-900 hover:bg-stone-200 text-[11px] transition-colors cursor-pointer"
                  >
                    {copiedPage === pageNum ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>이 페이지 복사</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Page Content */}
                <div className="p-4 sm:p-6">
                  {isEmptyText ? (
                    <p className="text-xs text-stone-400 italic">
                      (이 페이지에는 추출된 본문 텍스트가 없습니다 - 표 전용 페이지 또는 공백)
                    </p>
                  ) : (
                    <pre className="font-sans text-sm text-stone-800 whitespace-pre-wrap leading-relaxed break-words select-text">
                      {page.text}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
