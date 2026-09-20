import React, { useEffect, useState } from "react";
import {
  FileText,
  Table,
  Network,
  Code2,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { Header } from "./components/Header";
import { UploadSection } from "./components/UploadSection";
import { CommandStatusBanner } from "./components/CommandStatusBanner";
import { TextTab } from "./components/TextTab";
import { TablesTab } from "./components/TablesTab";
import { StructureTab } from "./components/StructureTab";
import { RawJsonTab } from "./components/RawJsonTab";
import { CanonicalDocumentTab } from "./components/CanonicalDocumentTab";
import { ParseApiResponse, RhwpCapabilities, RhwpStatusResponse } from "./types";

type MainTab = "canonical" | "text" | "tables" | "structure" | "json";

export default function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [rhwpVersion, setRhwpVersion] = useState<string | null>(null);
  const [binary, setBinary] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<RhwpCapabilities | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState<boolean>(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseApiResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<MainTab>("canonical");

  // Fetch initial CLI status & capabilities
  useEffect(() => {
    let isMounted = true;

    async function fetchStatus(retryCount = 0) {
      try {
        if (retryCount === 0) {
          setLoadingCapabilities(true);
        }

        const res = await fetch("/api/rhwp/status", {
          headers: { Accept: "application/json" },
        });

        // Defensive check: verify content-type is JSON
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          // If proxy or server warmup returned HTML, retry up to 3 times before setting error
          if (retryCount < 3) {
            setTimeout(() => {
              if (isMounted) fetchStatus(retryCount + 1);
            }, 1500);
            return;
          }

          if (isMounted) {
            setConnected(false);
            setRhwpVersion(null);
            setCapabilities(null);
            setConnectionError("서버 응답을 기다리는 중입니다. 잠시 후 새로고침해주세요.");
          }
          return;
        }

        const data: RhwpStatusResponse = await res.json();

        if (isMounted) {
          if (data.connected) {
            setConnected(true);
            setRhwpVersion(data.version || null);
            setBinary(data.binary || null);
            setCapabilities(data.capabilities || null);
            setConnectionError(null);
          } else {
            setConnected(false);
            setRhwpVersion(null);
            setBinary(data.binary || null);
            setCapabilities(null);
            setConnectionError(data.error || "rhwp CLI 실행파일을 찾을 수 없습니다.");
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (isMounted) {
          setConnected(false);
          setRhwpVersion(null);
          setCapabilities(null);
          setConnectionError(`rhwp 상태 확인 실패: ${message}`);
        }
      } finally {
        if (isMounted && retryCount === 0) {
          setLoadingCapabilities(false);
        }
      }
    }

    fetchStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setParseError(null);
  };

  const handleParse = async () => {
    if (!connected) {
      setParseError("rhwp CLI가 서버에 설치되어 있지 않습니다.");
      return;
    }
    if (!selectedFile) return;

    try {
      setIsParsing(true);
      setParseError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("서버에서 올바른 JSON 응답을 받지 못했습니다. 잠시 후 다시 시도해주세요.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `서버 오류 (HTTP ${response.status})`);
      }

      setParseResult(data as ParseApiResponse);
      setActiveTab("canonical");
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
    if (!connected) {
      setParseError("rhwp CLI가 서버에 설치되어 있지 않습니다.");
      return;
    }

    try {
      setIsParsing(true);
      setParseError(null);
      setSelectedFile(null);

      const response = await fetch(`/api/parse-sample?type=${type}`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("서버에서 올바른 JSON 응답을 받지 못했습니다. 잠시 후 다시 시도해주세요.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `샘플 파일 로드 실패 (HTTP ${response.status})`);
      }

      setParseResult(data as ParseApiResponse);
      setActiveTab("canonical");
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
      id: "canonical",
      label: "Canonical Document",
      count: parseResult?.canonical ? "v1.0" : undefined,
      icon: FileCheck,
    },
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
        connected={connected}
        rhwpVersion={rhwpVersion}
        binary={binary}
        capabilities={capabilities}
        loadingCapabilities={loadingCapabilities}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Upload & Action Section */}
        <UploadSection
          connected={connected}
          connectionError={connectionError}
          binary={binary}
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
              {activeTab === "canonical" && (
                <CanonicalDocumentTab
                  canonical={parseResult.canonical}
                  markdown={parseResult.canonical_markdown}
                  quality={parseResult.quality}
                />
              )}
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
            HWP/HWPX Canonical Document Builder • TASK 02
          </span>
          <span className="font-mono text-stone-400">
            {connected && rhwpVersion
              ? `Powered by rhwp ${rhwpVersion} CLI • No AI / LLM`
              : "rhwp CLI 미연결 • No AI / LLM"}
          </span>
        </div>
      </footer>
    </div>
  );
}
