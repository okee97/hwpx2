import React, { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Edit3,
  Save,
  X,
  Code2,
  Copy,
  Check,
  Building2,
  Calendar,
  DollarSign,
  Award,
  Scale,
  FileCheck2,
  Quote,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  BusinessMetadata,
  ExtractMetadataResponse,
  ProjectType,
  CompetitionMethod,
  AwardMethod,
} from "../types";

interface BusinessMetadataCardProps {
  canonicalMarkdown: string;
}

export function BusinessMetadataCard({
  canonicalMarkdown,
}: BusinessMetadataCardProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<ExtractMetadataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Editable local state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedMetadata, setEditedMetadata] = useState<BusinessMetadata | null>(
    null
  );

  // Raw JSON display toggle
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Trigger single-call extraction
  const handleExtract = async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setIsEditing(false);

    try {
      const res = await fetch("/api/extract-business-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonical_markdown: canonicalMarkdown,
        }),
      });

      const data: ExtractMetadataResponse = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "사업정보 추출에 실패했습니다.");
        setErrorCode(data.error_code || "AI_REQUEST_FAILED");
        setResponse(data);
      } else {
        setResponse(data);
        setEditedMetadata(data.metadata || null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`요청 처리 중 오류가 발생했습니다: ${msg}`);
      setErrorCode("AI_REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = () => {
    if (response && editedMetadata) {
      setResponse({
        ...response,
        metadata: editedMetadata,
      });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (response?.metadata) {
      setEditedMetadata(response.metadata);
    }
    setIsEditing(false);
  };

  const handleCopyJson = async () => {
    if (!response?.metadata) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(response.metadata, null, 2)
      );
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // Fallback
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const currentMeta = isEditing ? editedMetadata : response?.metadata;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
      {/* Top Header / CTA */}
      <div className="px-5 py-4 border-b border-stone-200 bg-linear-to-r from-stone-900 to-stone-800 text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              AI 사업정보 추출 (Strong LLM 단 1회 직접 분석)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/10 text-stone-200 border border-white/10">
              No Agent • No RAG • 100% 원문 근거
            </span>
          </div>
          <p className="text-xs text-stone-300 mt-1">
            rhwp의 Canonical Document 전체를 LLM Context에 직접 전달하여 사업 기본정보 및 원문 증거를 추출합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-extract-ai-metadata"
            onClick={handleExtract}
            disabled={loading || !canonicalMarkdown}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
              loading
                ? "bg-stone-700 text-stone-300 cursor-not-allowed"
                : "bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold hover:shadow-md active:scale-98"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span>AI가 전체 문서를 직접 분석하는 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{response?.metadata ? "AI 사업정보 재추출" : "AI로 사업정보 추출"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="m-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span>추출 오류</span>
                {errorCode && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-red-200 text-red-900">
                    {errorCode}
                  </span>
                )}
              </div>
              <p className="text-red-700">{error}</p>
              {errorCode === "MISSING_API_KEY" && (
                <p className="text-stone-600 mt-2 bg-white/70 p-2 rounded border border-red-100 font-mono text-[11px]">
                  💡 AI Studio의 Settings / Secrets 메뉴에서 GEMINI_API_KEY를 설정하거나 환경변수를 구성해주세요.
                </p>
              )}
              {errorCode === "DOCUMENT_TOO_LARGE" && (
                <p className="text-stone-600 mt-2 bg-white/70 p-2 rounded border border-red-100 text-[11px]">
                  💡 현재 모델의 최대 입력 컨텍스트(1,000,000 토큰)를 초과하여 몰래 잘라내지 않고 안전하게 거절했습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Banner (When extracted) */}
      {response?.success && response.metadata && (
        <div className="px-5 py-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-stone-500" />
              <span>모델:</span>
              <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                {response.model || "gemini-3.8-flash"}
              </span>
            </div>

            {response.duration_ms !== undefined && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>처리 시간:</span>
                <span className="font-mono font-semibold text-stone-900">
                  {response.duration_ms}ms
                </span>
              </div>
            )}

            {response.usage && (
              <div className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-stone-500" />
                <span>토큰 사용량:</span>
                <span className="font-mono text-stone-900">
                  입력 <strong>{response.usage.input_tokens.toLocaleString()}</strong> / 출력{" "}
                  <strong>{response.usage.output_tokens.toLocaleString()}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                id="btn-edit-metadata"
                onClick={() => {
                  setEditedMetadata(JSON.parse(JSON.stringify(response.metadata)));
                  setIsEditing(true);
                }}
                className="px-2.5 py-1 rounded bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>값 수정</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-save-metadata"
                  onClick={handleSaveEdit}
                  className="px-2.5 py-1 rounded bg-stone-900 hover:bg-stone-800 text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>저장</span>
                </button>
                <button
                  type="button"
                  id="btn-cancel-metadata"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 rounded bg-white hover:bg-stone-100 text-stone-600 border border-stone-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>취소</span>
                </button>
              </div>
            )}

            <button
              type="button"
              id="btn-toggle-raw-ai-json"
              onClick={() => setShowRawJson(!showRawJson)}
              className="px-2.5 py-1 rounded bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Code2 className="w-3 h-3" />
              <span>{showRawJson ? "Raw JSON 닫기" : "Raw JSON 보기"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Raw JSON View (Collapsible) */}
      {showRawJson && response?.metadata && (
        <div className="p-5 border-b border-stone-200 bg-stone-950 text-stone-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-stone-400">
              AI 응답 JSON Schema 결과물
            </span>
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedJson ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>JSON 복사</span>
                </>
              )}
            </button>
          </div>
          <pre className="text-xs font-mono max-h-72 overflow-auto p-3 rounded bg-stone-900 border border-stone-800 text-stone-200">
            {JSON.stringify(response.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Extracted Metadata Body */}
      {currentMeta ? (
        <div className="p-5 space-y-6">
          {/* 1. 기본 사업 정보 섹션 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-stone-700" />
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                1. 기본 사업 정보
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 사업명 */}
              <div className="md:col-span-2 lg:col-span-2 p-3.5 rounded-lg border border-stone-200 bg-stone-50/50">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  사업명 (project_name)
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentMeta.project_name || ""}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev ? { ...prev, project_name: e.target.value || null } : null
                      )
                    }
                    className="w-full text-xs font-semibold p-2 border border-stone-300 rounded bg-white text-stone-900"
                  />
                ) : (
                  <p className="text-sm font-bold text-stone-900 leading-snug">
                    {currentMeta.project_name || (
                      <span className="text-stone-400 font-normal">미기재 / null</span>
                    )}
                  </p>
                )}
              </div>

              {/* 사업유형 */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-stone-50/50">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  사업유형 (project_type)
                </span>
                {isEditing ? (
                  <select
                    value={currentMeta.project_type}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? { ...prev, project_type: e.target.value as ProjectType }
                          : null
                      )
                    }
                    className="w-full text-xs p-2 border border-stone-300 rounded bg-white text-stone-900"
                  >
                    <option value="SERVICE">용역 (SERVICE)</option>
                    <option value="RESEARCH">연구용역 (RESEARCH)</option>
                    <option value="IT">정보화 (IT)</option>
                    <option value="GOODS">물품 (GOODS)</option>
                    <option value="CONSTRUCTION">공사 (CONSTRUCTION)</option>
                    <option value="OTHER">기타 (OTHER)</option>
                    <option value="UNKNOWN">확인불가 (UNKNOWN)</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-900 text-white">
                      {currentMeta.project_type}
                    </span>
                  </div>
                )}
              </div>

              {/* 발주기관 */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  발주기관 / 수요기관 (ordering_agency)
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentMeta.ordering_agency || ""}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? { ...prev, ordering_agency: e.target.value || null }
                          : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  />
                ) : (
                  <p className="text-xs font-semibold text-stone-900">
                    {currentMeta.ordering_agency || (
                      <span className="text-stone-400 font-normal">미기재 / null</span>
                    )}
                  </p>
                )}
              </div>

              {/* 조달/계약기관 */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  계약(조달)기관 (procurement_agency)
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentMeta.procurement_agency || ""}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? { ...prev, procurement_agency: e.target.value || null }
                          : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  />
                ) : (
                  <p className="text-xs font-semibold text-stone-900">
                    {currentMeta.procurement_agency || (
                      <span className="text-stone-400 font-normal">
                        별도 기재 없음 (자체조달 등)
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* 과업기간 */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  과업기간 원문 (project_period.raw)
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentMeta.project_period?.raw || ""}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? {
                              ...prev,
                              project_period: { raw: e.target.value || null },
                            }
                          : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  />
                ) : (
                  <p className="text-xs font-semibold text-stone-900">
                    {currentMeta.project_period?.raw || (
                      <span className="text-stone-400 font-normal">미기재 / null</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2. 예산 및 입찰/낙찰 방식 섹션 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-stone-700" />
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                2. 예산 및 입찰·낙찰 방식
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 사업예산 */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-stone-50/50">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  사업예산 (budget.amount)
                </span>
                {isEditing ? (
                  <div className="space-y-1.5">
                    <input
                      type="number"
                      value={currentMeta.budget?.amount ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value);
                        setEditedMetadata((prev) =>
                          prev
                            ? {
                                ...prev,
                                budget: {
                                  ...prev.budget,
                                  amount: val,
                                },
                              }
                            : null
                        );
                      }}
                      className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                    />
                    <label className="flex items-center gap-1.5 text-[11px] text-stone-700">
                      <input
                        type="checkbox"
                        checked={currentMeta.budget?.vat_included ?? false}
                        onChange={(e) =>
                          setEditedMetadata((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  budget: {
                                    ...prev.budget,
                                    vat_included: e.target.checked,
                                  },
                                }
                              : null
                          )
                        }
                      />
                      <span>VAT 포함</span>
                    </label>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-stone-900 font-mono">
                      {currentMeta.budget?.amount !== null &&
                      currentMeta.budget?.amount !== undefined ? (
                        `${currentMeta.budget.amount.toLocaleString()} ${
                          currentMeta.budget.currency || "원"
                        }`
                      ) : (
                        <span className="text-stone-400 font-normal">미기재 / null</span>
                      )}
                    </p>
                    <span
                      className={`inline-block mt-1 text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        currentMeta.budget?.vat_included === true
                          ? "bg-emerald-100 text-emerald-800"
                          : currentMeta.budget?.vat_included === false
                          ? "bg-stone-200 text-stone-700"
                          : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {currentMeta.budget?.vat_included === true
                        ? "VAT 포함"
                        : currentMeta.budget?.vat_included === false
                        ? "VAT 별도/면세"
                        : "VAT 여부 미확인"}
                    </span>
                  </div>
                )}
              </div>

              {/* 경쟁방법 */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  경쟁방법 (competition_method)
                </span>
                {isEditing ? (
                  <select
                    value={currentMeta.competition_method}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? {
                              ...prev,
                              competition_method: e.target.value as CompetitionMethod,
                            }
                          : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  >
                    <option value="OPEN_COMPETITIVE">일반경쟁입찰</option>
                    <option value="RESTRICTED_COMPETITIVE">제한경쟁입찰</option>
                    <option value="NOMINATED_COMPETITIVE">지명경쟁입찰</option>
                    <option value="PRIVATE_CONTRACT">수의계약</option>
                    <option value="UNKNOWN">확인불가 (UNKNOWN)</option>
                  </select>
                ) : (
                  <div className="mt-1">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200">
                      {currentMeta.competition_method === "RESTRICTED_COMPETITIVE"
                        ? "제한경쟁입찰"
                        : currentMeta.competition_method === "OPEN_COMPETITIVE"
                        ? "일반경쟁입찰"
                        : currentMeta.competition_method === "PRIVATE_CONTRACT"
                        ? "수의계약"
                        : currentMeta.competition_method}
                    </span>
                  </div>
                )}
              </div>

              {/* 낙찰방법 */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  낙찰방법 (award_method)
                </span>
                {isEditing ? (
                  <select
                    value={currentMeta.award_method}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? {
                              ...prev,
                              award_method: e.target.value as AwardMethod,
                            }
                          : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  >
                    <option value="NEGOTIATION">협상에 의한 계약</option>
                    <option value="QUALIFICATION_REVIEW">적격심사</option>
                    <option value="LOWEST_PRICE">최저가낙찰제</option>
                    <option value="TWO_STAGE">2단계 경쟁</option>
                    <option value="SPEC_PRICE_SIMULTANEOUS">규격가격동시입찰</option>
                    <option value="OTHER">기타</option>
                    <option value="UNKNOWN">확인불가 (UNKNOWN)</option>
                  </select>
                ) : (
                  <div className="mt-1">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      {currentMeta.award_method === "NEGOTIATION"
                        ? "협상에 의한 계약"
                        : currentMeta.award_method === "QUALIFICATION_REVIEW"
                        ? "적격심사"
                        : currentMeta.award_method}
                    </span>
                  </div>
                )}
              </div>

              {/* 기술/가격 배점 */}
              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  평가 배점 (기술 : 가격)
                </span>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="기술"
                      value={currentMeta.evaluation?.technical_score ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value);
                        setEditedMetadata((prev) =>
                          prev
                            ? {
                                ...prev,
                                evaluation: {
                                  ...prev.evaluation,
                                  technical_score: val,
                                },
                              }
                            : null
                        );
                      }}
                      className="w-1/2 text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                    />
                    <span>:</span>
                    <input
                      type="number"
                      placeholder="가격"
                      value={currentMeta.evaluation?.price_score ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value);
                        setEditedMetadata((prev) =>
                          prev
                            ? {
                                ...prev,
                                evaluation: {
                                  ...prev.evaluation,
                                  price_score: val,
                                },
                              }
                            : null
                        );
                      }}
                      className="w-1/2 text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-stone-900 font-mono">
                      기술 {currentMeta.evaluation?.technical_score ?? "-"}점 : 가격{" "}
                      {currentMeta.evaluation?.price_score ?? "-"}점
                    </p>
                    {currentMeta.evaluation?.technical_score !== null &&
                      currentMeta.evaluation?.price_score !== null && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-stone-200 flex overflow-hidden">
                          <div
                            style={{
                              width: `${currentMeta.evaluation.technical_score}%`,
                            }}
                            className="bg-stone-800"
                          />
                          <div
                            style={{
                              width: `${currentMeta.evaluation.price_score}%`,
                            }}
                            className="bg-amber-400"
                          />
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. 참가자격 및 계약 조건 섹션 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-stone-700" />
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                3. 입찰참가자격 및 계약 조건
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  참가등록 업종 (business_type)
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentMeta.participation?.business_type || ""}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? {
                              ...prev,
                              participation: {
                                ...prev.participation,
                                business_type: e.target.value || null,
                              },
                            }
                          : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  />
                ) : (
                  <p className="text-xs font-semibold text-stone-900">
                    {currentMeta.participation?.business_type || (
                      <span className="text-stone-400 font-normal">미기재 / null</span>
                    )}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  업종코드 (business_code)
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentMeta.participation?.business_code || ""}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? {
                              ...prev,
                              participation: {
                                ...prev.participation,
                                business_code: e.target.value || null,
                              },
                            }
                          : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  />
                ) : (
                  <p className="text-xs font-semibold text-stone-900 font-mono">
                    {currentMeta.participation?.business_code || (
                      <span className="text-stone-400 font-normal">미기재 / null</span>
                    )}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  기업제한 / 중소기업 규정
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentMeta.participation?.sme_restriction || ""}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev
                          ? {
                              ...prev,
                              participation: {
                                ...prev.participation,
                                sme_restriction: e.target.value || null,
                              },
                            }
                          : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  />
                ) : (
                  <p className="text-xs font-semibold text-stone-900">
                    {currentMeta.participation?.sme_restriction || (
                      <span className="text-stone-400 font-normal">미기재 / null</span>
                    )}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  공동계약(공동이행) 허용
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    currentMeta.participation?.joint_contract_allowed === true
                      ? "bg-emerald-100 text-emerald-800"
                      : currentMeta.participation?.joint_contract_allowed === false
                      ? "bg-red-100 text-red-800"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {currentMeta.participation?.joint_contract_allowed === true
                    ? "허용"
                    : currentMeta.participation?.joint_contract_allowed === false
                    ? "불허 (공동이행 불가)"
                    : "미기재"}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  하도급 허용 여부
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    currentMeta.participation?.subcontract_allowed === true
                      ? "bg-emerald-100 text-emerald-800"
                      : currentMeta.participation?.subcontract_allowed === false
                      ? "bg-red-100 text-red-800"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {currentMeta.participation?.subcontract_allowed === true
                    ? "허용"
                    : currentMeta.participation?.subcontract_allowed === false
                    ? "불허 (원칙적 불가)"
                    : "미기재"}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-[11px] font-medium text-stone-500 block mb-1">
                  적용 법령 (governing_law)
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={currentMeta.governing_law || ""}
                    onChange={(e) =>
                      setEditedMetadata((prev) =>
                        prev ? { ...prev, governing_law: e.target.value || null } : null
                      )
                    }
                    className="w-full text-xs p-1.5 border border-stone-300 rounded bg-white text-stone-900"
                  />
                ) : (
                  <p className="text-xs text-stone-800 line-clamp-2">
                    {currentMeta.governing_law || (
                      <span className="text-stone-400 font-normal">미기재 / null</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 4. 사업 개요 및 요약 */}
          {currentMeta.summary && (
            <div className="p-4 rounded-lg bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold text-stone-700 block mb-1">
                사업 개요 / 과업 요약 (summary)
              </span>
              <p className="text-xs text-stone-700 leading-relaxed">
                {currentMeta.summary}
              </p>
            </div>
          )}

          {/* 5. 원문 근거 (Evidence) 목록 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Quote className="w-4 h-4 text-stone-700" />
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  4. 원문 근거 및 출처 (Evidence Quotes)
                </h4>
              </div>
              <span className="text-[11px] text-stone-500 font-mono">
                총 {currentMeta.evidence?.length || 0}건의 근거
              </span>
            </div>

            {currentMeta.evidence && currentMeta.evidence.length > 0 ? (
              <div className="space-y-2">
                {currentMeta.evidence.map((item, idx) => (
                  <div
                    key={`evidence-${idx}`}
                    className="p-3 rounded-lg border border-stone-200 bg-white text-xs hover:border-stone-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-stone-900 text-white">
                          {item.source.type === "PAGE"
                            ? `[PAGE ${item.source.page}]`
                            : `[TABLE ${item.source.table_id}]`}
                        </span>
                        <span className="font-semibold text-stone-800">
                          {item.field}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          item.status === "EXPLICIT"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "INFERRED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-stone-200 text-stone-600"
                        }`}
                      >
                        {item.status === "EXPLICIT"
                          ? "명시적 기재"
                          : item.status === "INFERRED"
                          ? "정황 추론"
                          : "미발견"}
                      </span>
                    </div>

                    <div className="pl-3 border-l-2 border-stone-300 text-stone-700 italic font-mono text-[11px] bg-stone-50/50 py-1 rounded-r">
                      "{item.quote}"
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 p-3 bg-stone-50 rounded border border-stone-200 text-center">
                추출된 근거가 없습니다.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-stone-50/40">
          <Sparkles className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-stone-600">
            상단의 <strong>[AI로 사업정보 추출]</strong> 버튼을 클릭하면,
          </p>
          <p className="text-xs text-stone-400 mt-1">
            정규화된 Canonical Document 전체를 LLM에 전달하여 공공조달 핵심 사업정보를 원문 근거와 함께 추출합니다.
          </p>
        </div>
      )}
    </div>
  );
}
