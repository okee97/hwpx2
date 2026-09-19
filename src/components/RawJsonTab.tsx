import React, { useState, useMemo } from "react";
import { Code2, Copy, Check, Download, Search, FileJson } from "lucide-react";
import { ParseApiResponse, RhwpCapabilities } from "../types";

interface RawJsonTabProps {
  parseResult: ParseApiResponse | null;
  capabilities: RhwpCapabilities | null;
}

type JsonSection = "info" | "text" | "tables" | "structure" | "capabilities" | "execution" | "full";

export const RawJsonTab: React.FC<RawJsonTabProps> = ({
  parseResult,
  capabilities,
}) => {
  const [activeSection, setActiveSection] = useState<JsonSection>("info");
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sectionData = useMemo(() => {
    if (!parseResult && activeSection !== "capabilities") {
      return null;
    }

    switch (activeSection) {
      case "info":
        return parseResult?.info ?? null;
      case "text":
        return parseResult?.text ?? null;
      case "tables":
        return parseResult?.tables ?? null;
      case "structure":
        return parseResult?.structure ?? null;
      case "capabilities":
        return parseResult?.rhwp.capabilities ?? capabilities ?? null;
      case "execution":
        return parseResult?.execution ?? null;
      case "full":
        return parseResult ?? null;
      default:
        return null;
    }
  }, [activeSection, parseResult, capabilities]);

  const jsonString = useMemo(() => {
    if (sectionData === null || sectionData === undefined) {
      return "// rhwp 명령 결과가 없거나 데이터가 비어 있습니다 (null)";
    }
    try {
      return JSON.stringify(sectionData, null, 2);
    } catch {
      return "// JSON 직렬화 오류";
    }
  }, [sectionData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rhwp_${activeSection}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections: { key: JsonSection; label: string; badge?: string }[] = [
    { key: "info", label: "info", badge: parseResult?.info ? "JSON" : undefined },
    { key: "text", label: "export-text", badge: parseResult?.text ? "JSON" : undefined },
    { key: "tables", label: "export-tables", badge: parseResult?.tables ? "JSON" : undefined },
    { key: "structure", label: "export-structure", badge: parseResult?.structure ? "JSON" : undefined },
    { key: "capabilities", label: "capabilities", badge: "CLI" },
    { key: "execution", label: "execution (실행기록)" },
    { key: "full", label: "전체 원본 (Full API)" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-Tabs Selector */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {sections.map((sec) => {
            const isActive = activeSection === sec.key;
            return (
              <button
                key={sec.key}
                type="button"
                id={`subtab-json-${sec.key}`}
                onClick={() => setActiveSection(sec.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-stone-900 text-white shadow-xs"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                }`}
              >
                <span>{sec.label}</span>
                {sec.badge && (
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                      isActive ? "bg-stone-700 text-stone-200" : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            type="button"
            id="btn-copy-json"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "복사 완료" : "JSON 복사"}</span>
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.json 저장</span>
          </button>
        </div>
      </div>

      {/* JSON Viewer */}
      <div className="bg-stone-950 rounded-xl border border-stone-800 shadow-md overflow-hidden text-xs">
        {/* Editor-like Top Bar */}
        <div className="px-4 py-2 bg-stone-900 border-b border-stone-800 flex items-center justify-between text-stone-400">
          <div className="flex items-center gap-2">
            <FileJson className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-stone-300 font-semibold">
              rhwp {activeSection}.json
            </span>
            <span className="text-[11px] text-stone-500 font-mono">
              ({jsonString.split("\n").length.toLocaleString()} lines)
            </span>
          </div>
          <span className="text-[11px] text-stone-400">
            rhwp CLI 반환 원본 JSON 유지 (인위적 가공 없음)
          </span>
        </div>

        {/* JSON Code Area */}
        <div className="p-4 overflow-x-auto max-h-[650px] overflow-y-auto font-mono text-emerald-400 selection:bg-emerald-900/60 selection:text-white">
          <pre className="whitespace-pre leading-relaxed">{jsonString}</pre>
        </div>
      </div>
    </div>
  );
};
