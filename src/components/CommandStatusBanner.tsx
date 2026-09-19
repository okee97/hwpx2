import React, { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Terminal, AlertTriangle } from "lucide-react";
import { RhwpExecutionResult } from "../types";

interface CommandStatusBannerProps {
  execution: {
    info: RhwpExecutionResult;
    export_text: RhwpExecutionResult;
    export_tables: RhwpExecutionResult;
    export_structure: RhwpExecutionResult;
  } | null;
}

export const CommandStatusBanner: React.FC<CommandStatusBannerProps> = ({ execution }) => {
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);

  if (!execution) return null;

  const commands = [
    { key: "info", name: "info", title: "문서 정보 (info)", result: execution.info },
    { key: "export_text", name: "export-text", title: "텍스트 추출 (export-text)", result: execution.export_text },
    { key: "export_tables", name: "export-tables", title: "표 추출 (export-tables)", result: execution.export_tables },
    { key: "export_structure", name: "export-structure", title: "구조 추출 (export-structure)", result: execution.export_structure },
  ];

  const toggleExpand = (key: string) => {
    setExpandedCmd(expandedCmd === key ? null : key);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs mb-6 overflow-hidden">
      <div className="px-5 py-3.5 bg-stone-50/80 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-stone-600" />
          <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
            rhwp CLI 실행 내역 및 Exit Code
          </span>
        </div>
        <span className="text-xs text-stone-500">
          각 명령을 클릭하여 세부 인자 및 stderr 진단 로그 확인
        </span>
      </div>

      <div className="divide-y divide-stone-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
          {commands.map(({ key, name, title, result }) => {
            const isSuccess = result?.success ?? false;
            const exitCode = result?.exitCode ?? -1;
            const hasStderr = Boolean(result?.stderr && result.stderr.length > 0);
            const isExpanded = expandedCmd === key;

            return (
              <div
                key={key}
                id={`cmd-card-${key}`}
                onClick={() => toggleExpand(key)}
                className={`p-3.5 cursor-pointer transition-colors hover:bg-stone-50 ${
                  isExpanded ? "bg-stone-50/80" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-semibold text-stone-800">
                    {name}
                  </span>
                  <div className="flex items-center gap-1">
                    {isSuccess ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> 성공
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                        <XCircle className="w-3 h-3" /> 실패
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Exit Code: <strong className="font-mono text-stone-800">{exitCode}</strong></span>
                  <span>{result?.durationMs ?? 0}ms</span>
                </div>

                {hasStderr && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span className="truncate">진단/경고 로그 기록됨</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded detail box */}
        {expandedCmd && (
          <div className="p-4 bg-stone-900 text-stone-200 text-xs font-mono border-t border-stone-200">
            {(() => {
              const item = commands.find((c) => c.key === expandedCmd);
              if (!item) return null;
              const res = item.result;

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-stone-400 border-b border-stone-800 pb-1">
                    <span className="font-semibold text-stone-300">
                      명령: rhwp {item.name}
                    </span>
                    <span>소요 시간: {res.durationMs}ms | Exit Code: {res.exitCode}</span>
                  </div>

                  <div>
                    <span className="text-stone-500 block mb-0.5">실행 인자 (Argument Array):</span>
                    <p className="bg-stone-950 p-2 rounded text-emerald-400 overflow-x-auto">
                      ["{res.command.join('", "')}"]
                    </p>
                  </div>

                  {res.stderr && (
                    <div>
                      <span className="text-amber-400 block mb-0.5">
                        stderr 출력 (진단/조판 경고 로그):
                      </span>
                      <pre className="bg-stone-950 p-2 rounded text-amber-200/90 text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {res.stderr}
                      </pre>
                    </div>
                  )}

                  {res.error && (
                    <div>
                      <span className="text-red-400 block mb-0.5">오류 메시지:</span>
                      <p className="bg-red-950/50 border border-red-800 p-2 rounded text-red-200">
                        {res.error}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
