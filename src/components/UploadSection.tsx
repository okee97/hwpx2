import React, { useRef, useState } from "react";
import {
  Upload,
  FileCheck,
  Loader2,
  CheckCircle,
  XCircle,
  Play,
  FileCode2,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { ParseApiResponse } from "../types";

interface UploadSectionProps {
  connected: boolean;
  connectionError?: string | null;
  binary?: string | null;
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onParse: () => void;
  onParseSample: (type: "hwp" | "hwpx") => void;
  isParsing: boolean;
  parseResult: ParseApiResponse | null;
  parseError: string | null;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  connected,
  connectionError,
  binary,
  selectedFile,
  onFileSelect,
  onParse,
  onParseSample,
  isParsing,
  parseResult,
  parseError,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase();
      if (ext.endsWith(".hwp") || ext.endsWith(".hwpx")) {
        onFileSelect(file);
      } else {
        alert(".hwp 또는 .hwpx 형식의 파일만 지원됩니다.");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const fileFormat = selectedFile
    ? selectedFile.name.toLowerCase().endsWith(".hwpx")
      ? "HWPX"
      : selectedFile.name.toLowerCase().endsWith(".hwp")
      ? "HWP"
      : "기타"
    : parseResult
    ? parseResult.file.format.toUpperCase()
    : null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-5 sm:p-6 mb-6">
      {/* CLI Disconnected Warning Banner */}
      {!connected && (
        <div
          id="rhwp-disconnected-alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-950">
                rhwp CLI가 서버에 설치되어 있지 않습니다.
              </h3>
              <p className="text-xs text-red-800 mt-1 leading-relaxed">
                {connectionError || "서버 환경에서 rhwp 실행파일을 찾을 수 없습니다."}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="text-red-700 font-sans">시도된 바이너리:</span>
                <code className="bg-red-100/80 px-2 py-0.5 rounded text-red-950 font-bold">
                  {binary || "rhwp"}
                </code>
                <span className="text-stone-400">•</span>
                <span className="text-red-700 font-sans">
                  .env의 RHWP_BIN 설정 또는 PATH 등록이 필요합니다.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Upload & Drag Drop Area */}
        <div className="lg:col-span-7">
          <div
            id="hwp-drop-zone"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 transition-all text-center flex flex-col items-center justify-center gap-3 ${
              isDragOver
                ? "border-amber-500 bg-amber-50/60"
                : selectedFile
                ? "border-emerald-400 bg-emerald-50/20"
                : "border-stone-300 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".hwp,.hwpx"
              onChange={handleFileInputChange}
              className="hidden"
              id="hwp-file-input"
            />

            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                selectedFile
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-stone-200/80 text-stone-600"
              }`}
            >
              {selectedFile ? (
                <FileCheck className="w-6 h-6" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-stone-800">
                {selectedFile
                  ? selectedFile.name
                  : "HWP 또는 HWPX 파일을 드래그하거나 클릭하여 선택"}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                {selectedFile
                  ? `${formatFileSize(selectedFile.size)} • 클릭하여 다른 파일 선택`
                  : "최대 50MB 지원 • 표준 한글 HWP 5.0 및 HWPX"}
              </p>
            </div>
          </div>

          {/* Quick sample testing shortcuts */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-stone-600">
            <span className="font-medium text-stone-500">빠른 샘플 테스트:</span>
            <button
              type="button"
              id="btn-sample-hwp"
              onClick={(e) => {
                e.stopPropagation();
                onParseSample("hwp");
              }}
              disabled={!connected || isParsing}
              title={!connected ? "rhwp CLI가 서버에 설치되어 있지 않습니다." : undefined}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileCode2 className="w-3.5 h-3.5 text-stone-500" />
              <span>sample_table.hwp (1,000행 표)</span>
            </button>
            <button
              type="button"
              id="btn-sample-hwpx"
              onClick={(e) => {
                e.stopPropagation();
                onParseSample("hwpx");
              }}
              disabled={!connected || isParsing}
              title={!connected ? "rhwp CLI가 서버에 설치되어 있지 않습니다." : undefined}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileCode2 className="w-3.5 h-3.5 text-stone-500" />
              <span>sample_table.hwpx (HWPX)</span>
            </button>
          </div>
        </div>

        {/* File Details & Action Panel */}
        <div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-stone-200 lg:pl-6 pt-4 lg:pt-0">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block mb-1">문서 포맷</span>
              <span className="font-mono font-bold text-sm text-stone-900">
                {fileFormat ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      fileFormat === "HWPX"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {fileFormat}
                  </span>
                ) : (
                  "-"
                )}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block mb-1">파일 크기</span>
              <span className="font-mono font-medium text-sm text-stone-900">
                {selectedFile
                  ? formatFileSize(selectedFile.size)
                  : parseResult
                  ? formatFileSize(parseResult.file.size)
                  : "-"}
              </span>
            </div>

            <div className="col-span-2 p-3 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-stone-500 block text-xs">파싱 엔진 상태</span>
                <span className="font-medium text-xs text-stone-800">
                  {!connected
                    ? "rhwp CLI 미연결 (파싱 불가)"
                    : isParsing
                    ? "rhwp CLI 실행 중..."
                    : parseResult
                    ? parseResult.success
                      ? "파싱 완료 (성공)"
                      : "파싱 실패"
                    : parseError
                    ? "오류 발생"
                    : "준비 완료 (파일 대기)"}
                </span>
              </div>
              <div>
                {!connected ? (
                  <span title="CLI 미연결">
                    <Ban className="w-5 h-5 text-red-500" />
                  </span>
                ) : isParsing ? (
                  <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                ) : parseResult ? (
                  parseResult.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )
                ) : parseError ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                )}
              </div>
            </div>
          </div>

          {/* Parse Start Button */}
          <div>
            <button
              id="btn-start-parsing"
              type="button"
              onClick={onParse}
              disabled={!connected || !selectedFile || isParsing}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs ${
                !connected
                  ? "bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-300"
                  : !selectedFile || isParsing
                  ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                  : "bg-stone-900 hover:bg-stone-800 text-white active:scale-[0.99] cursor-pointer"
              }`}
            >
              {!connected ? (
                <>
                  <Ban className="w-4 h-4 text-red-500" />
                  <span>rhwp CLI 미연결 (파싱 불가)</span>
                </>
              ) : isParsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>rhwp 파싱 처리 중...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>파싱 시작 (rhwp 실행)</span>
                </>
              )}
            </button>

            {!connected && (
              <p className="text-[11px] text-red-600 font-medium text-center mt-2">
                rhwp CLI가 서버에 설치되어 있지 않습니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
