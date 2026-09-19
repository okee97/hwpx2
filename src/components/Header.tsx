import React from "react";
import { FileText, CheckCircle2, AlertCircle, Terminal, ShieldCheck } from "lucide-react";
import { RhwpCapabilities } from "../types";

interface HeaderProps {
  rhwpVersion: string | null;
  capabilities: RhwpCapabilities | null;
  loadingCapabilities: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  rhwpVersion,
  capabilities,
  loadingCapabilities,
}) => {
  return (
    <header className="border-b border-stone-200 bg-white shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center font-bold shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">
                HWP / HWPX Parser
              </h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                TASK 01
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              rhwp CLI 기반 공공기관 HWP 및 HWPX 문서 파싱 품질 검증 웹앱
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* CLI Engine Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stone-100 border border-stone-200 text-stone-700">
            <Terminal className="w-3.5 h-3.5 text-stone-600" />
            <span className="text-stone-500">엔진:</span>
            <span className="font-mono font-semibold text-stone-900">
              {loadingCapabilities ? "확인 중..." : rhwpVersion || "rhwp 미연결"}
            </span>
            {rhwpVersion && rhwpVersion !== "unknown" ? (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="CLI 정상" />
            ) : (
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="CLI 오류" />
            )}
          </div>

          {/* Supported Formats Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stone-50 border border-stone-200 text-stone-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>지원:</span>
            <span className="font-mono font-medium text-stone-800">HWP 5.0, HWPX, HML</span>
          </div>

          {/* AI Exclusion Notice */}
          <div className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-stone-50 text-stone-500 text-xs border border-stone-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
            <span>AI·LLM 무사용 (순수 CLI 원본 파싱)</span>
          </div>
        </div>
      </div>
    </header>
  );
};
