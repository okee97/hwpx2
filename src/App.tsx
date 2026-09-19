import React, { useEffect, useState } from "react";
import {
  FileText,
  Table,
  Network,
  Code2,
  AlertCircle,
  Clock,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { Header } from "./components/Header";
import { UploadSection } from "./components/UploadSection";
import { CommandStatusBanner } from "./components/CommandStatusBanner";
import { TextTab } from "./components/TextTab";
import { TablesTab } from "./components/TablesTab";
import { StructureTab } from "./components/StructureTab";
import { RawJsonTab } from "./components/RawJsonTab";
import { ParseApiResponse, RhwpCapabilities } from "./types";

type MainTab = "text" | "tables" | "structure" | "json";

export default function App() {
  const [rhwpVersion, setRhwpVersion] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<RhwpCapabilities | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState<boolean>(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseApiResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<MainTab>("text");

  // Fetch initial CLI status & capabilities
  useEffect(() => {
    async function fetchStatus() {
      try {
        setLoadingCapabilities(true);
        const res = await fetch("/api/rhwp/status");
        if (!res.ok) {
          throw new Error(`서버 응답 오류 (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (data.success) {
          setRhwpVersion(data.version);
          setCapabilities(data.capabilities);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("rhwp 상태 로드 실패:", message);
      } finally {
        setLoadingCapabilities(false);
      }
    }

    fetchStatus();
  }, []);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setParseError(null);
  };

  const handleParse = async () => {
    if (!selectedFile) return;

    try {
      setIsParsing(true);
      setParseError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `서버 오류 (HTTP ${response.status})`);
      }

      setParseResult(data as ParseApiResponse);
      if (data.rhwp?.version) {
        setRhwpVersion(data.rhwp.version);
      }
      if (data.rhwp?.capabilities) {
        setCapabilities(data.rhwp.capabilities);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setParseError(message);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseSample = async (type: "hwp" | "hwpx") => {
    try {
      setIsParsing(true);
      setParseError(null);
      setSelectedFile(null);

      const response = await fetch(`/api/parse-sample?type=${type}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `샘플 파일 로드 실패 (HTTP ${response.status})`);
      }

      setParseResult(data as ParseApiResponse);
      if (data.rhwp?.version) {
        setRhwpVersion(data.rhwp.version);
      }
      if (data.rhwp?.capabilities) {
        setCapabilities(data.rhwp.capabilities);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setParseError(message);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const tabs: { id: MainTab; label: string; count?: number | string; icon: React.FC<{ className?: string }> }[] = [
    {
      id: "text",
      label: "전체 텍스트",
      count: parseResult?.text?.pageCount !== undefined ? `${parseResult.text.pageCount}쪽` : undefined,
      icon: FileText,
    },
    {
      id: "tables",
      label: "표",
      count: parseResult?.tables?.tableCount !== undefined ? `${parseResult.tables.tableCount}개` : undefined,
      icon: Table,
    },
    {
      id: "structure",
      label: "문서 구조",
      count: parseResult?.structure?.nodeCount !== undefined ? `${parseResult.structure.nodeCount}노드` : undefined,
      icon: Network,
    },
    {
      id: "json",
      label: "Raw JSON",
      count: "Pretty Print",
      icon: Code2,
    },
  ];

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans antialiased">
      {/* Top App Header */}
      <Header
        rhwpVersion={rhwpVersion}
        capabilities={capabilities}
        loadingCapabilities={loadingCapabilities}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Upload & Action Section */}
        <UploadSection
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          onParse={handleParse}
          onParseSample={handleParseSample}
          isParsing={isParsing}
          parseResult={parseResult}
          parseError={parseError}
        />

        {/* Global Error Banner */}
        {parseError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">문서 파싱 처리 실패</h4>
              <p className="text-xs mt-1 text-red-700 leading-relaxed">
                {parseError}
              </p>
            </div>
          </div>
        )}

        {/* Result Area */}
        {parseResult && (
          <div className="space-y-6">
            {/* Command Execution Diagnostic Banner */}
            <CommandStatusBanner execution={parseResult.execution} />

            {/* Document Info Quick Summary Bar (if info exists) */}
            {parseResult.info && (
              <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <span className="text-stone-500 block text-[11px]">파일명</span>
                    <span className="font-semibold text-stone-900">{parseResult.file.name}</span>
                  </div>
                  <div className="h-6 w-px bg-stone-200 hidden sm:block" />
                  <div>
                    <span className="text-stone-500 block text-[11px]">형식 / HWP 버전</span>
                    <span className="font-mono text-stone-900 font-medium">
                      {parseResult.info.format} ({parseResult.info.version || "-"})
                    </span>
                  </div>
                  <div className="h-6 w-px bg-stone-200 hidden sm:block" />
                  <div>
                    <span className="text-stone-500 block text-[11px]">페이지 / 문단 수</span>
                    <span className="font-mono text-stone-900 font-medium">
                      {parseResult.info.pageCount ?? "-"}쪽 / {parseResult.info.paraCount ?? "-"}문단
                    </span>
                  </div>
                  {parseResult.info.lastSavedWith?.product && (
                    <>
                      <div className="h-6 w-px bg-stone-200 hidden sm:block" />
                      <div>
                        <span className="text-stone-500 block text-[11px]">저장 소프트웨어</span>
                        <span className="text-stone-800">
                          {parseResult.info.lastSavedWith.product} ({parseResult.info.lastSavedWith.version || ""})
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {parseResult.info.fonts && parseResult.info.fonts.length > 0 && (
                  <div className="text-[11px] text-stone-500">
                    폰트: <span className="text-stone-800 font-medium">{Array.from(new Set(parseResult.info.fonts)).slice(0, 4).join(", ")}</span>
                    {new Set(parseResult.info.fonts).size > 4 && ` 외 ${new Set(parseResult.info.fonts).size - 4}종`}
                  </div>
                )}
              </div>
            )}

            {/* 4 Tabs Navigation */}
            <div className="border-b border-stone-200">
              <nav className="flex space-x-2" aria-label="Tabs">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      id={`tab-${tab.id}`}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-3 px-4 rounded-t-lg font-medium text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                        isActive
                          ? "border-stone-900 text-stone-900 bg-white shadow-xs font-bold"
                          : "border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span
                          className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                            isActive
                              ? "bg-stone-100 text-stone-900 font-semibold"
                              : "bg-stone-200/80 text-stone-600"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Panes */}
            <div>
              {activeTab === "text" && (
                <TextTab textData={parseResult.text} />
              )}
              {activeTab === "tables" && (
                <TablesTab tablesData={parseResult.tables} />
              )}
              {activeTab === "structure" && (
                <StructureTab structureData={parseResult.structure} />
              )}
              {activeTab === "json" && (
                <RawJsonTab
                  parseResult={parseResult}
                  capabilities={capabilities}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-200 bg-white py-4 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            HWP/HWPX Parser Quality Verification App • TASK 01
          </span>
          <span className="font-mono text-stone-400">
            Powered by rhwp {rhwpVersion || "v0.8.6"} CLI • No AI / LLM
          </span>
        </div>
      </footer>
    </div>
  );
}
