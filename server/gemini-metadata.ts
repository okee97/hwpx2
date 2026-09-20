import { GoogleGenAI, Type } from "@google/genai";
import {
  BusinessMetadata,
  ExtractMetadataResponse,
  MetadataEvidence,
} from "../src/types.ts";

export const SYSTEM_PROMPT = `당신은 대한민국 공공조달 제안요청서와 과업내용서를 검토하는
전문 계약·구매 담당자입니다.

다음에 제공되는 문서는 HWP/HWPX 원본을
rhwp로 파싱하여 생성한 Canonical Document입니다.

문서 전체를 처음부터 끝까지 충분히 읽고
사업의 구조를 이해한 후 사업 기본정보를 추출하십시오.

중요 원칙:

- 문서에 실제 존재하는 내용만 근거로 판단합니다.
- 문서에 없는 내용은 추측하지 않습니다.
- 일반적인 관행을 근거로 값을 만들어내지 않습니다.
- 확인할 수 없는 값은 null 또는 UNKNOWN으로 반환합니다.
- 경쟁방법과 낙찰방법은 반드시 구분합니다.
- 사업예산과 추정가격을 혼동하지 않습니다.
- 기관의 역할이 명확하지 않으면 임의로 확정하지 않습니다.
- 모든 주요 판단에는 가능한 한 실제 원문 근거를 제시합니다.
- 원문 quote는 재작성하지 않고 실제 문구를 사용합니다.

내부 사고과정이나 긴 설명은 출력하지 마십시오.

지정된 JSON Schema에 맞는 JSON만 반환하십시오.`;

export const BUSINESS_METADATA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    project_name: {
      type: Type.STRING,
      description: "사업명/용역명/공고명 (확인할 수 없으면 null)",
      nullable: true,
    },
    ordering_agency: {
      type: Type.STRING,
      description: "발주기관/수요기관 (확인할 수 없으면 null)",
      nullable: true,
    },
    procurement_agency: {
      type: Type.STRING,
      description: "계약기관/조달청 등 공고/입찰을 대행하는 조달기관 (명확하지 않으면 null)",
      nullable: true,
    },
    project_type: {
      type: Type.STRING,
      enum: ["SERVICE", "GOODS", "CONSTRUCTION", "RESEARCH", "IT", "OTHER", "UNKNOWN"],
      description: "사업 유형",
    },
    project_period: {
      type: Type.OBJECT,
      properties: {
        raw: {
          type: Type.STRING,
          description: "과업기간 원문 표기 (예: '계약체결일로부터 ~ ‘26. 12. 31')",
          nullable: true,
        },
      },
      required: ["raw"],
    },
    budget: {
      type: Type.OBJECT,
      properties: {
        amount: {
          type: Type.NUMBER,
          description: "사업예산(총액, 숫자 원화). 추정가격과 혼동하지 말 것. 49,993,000원이면 49993000.",
          nullable: true,
        },
        currency: {
          type: Type.STRING,
          description: "통화단위 (예: 'KRW')",
          nullable: true,
        },
        vat_included: {
          type: Type.BOOLEAN,
          description: "부가가치세 포함 여부 (포함: true, 면세/미포함/별도: false, 미확인: null)",
          nullable: true,
        },
      },
      required: ["amount", "currency", "vat_included"],
    },
    competition_method: {
      type: Type.STRING,
      enum: ["OPEN_COMPETITIVE", "RESTRICTED_COMPETITIVE", "NOMINATED_COMPETITIVE", "PRIVATE_CONTRACT", "UNKNOWN"],
      description: "경쟁방법 (일반경쟁, 제한경쟁, 지명경쟁, 수의계약 등. 낙찰방법과 구분할 것)",
    },
    award_method: {
      type: Type.STRING,
      enum: ["NEGOTIATION", "QUALIFICATION_REVIEW", "LOWEST_PRICE", "TWO_STAGE", "SPEC_PRICE_SIMULTANEOUS", "OTHER", "UNKNOWN"],
      description: "낙찰자 결정방법 (협상에 의한 계약, 적격심사, 최저가 등)",
    },
    evaluation: {
      type: Type.OBJECT,
      properties: {
        technical_score: {
          type: Type.NUMBER,
          description: "기술능력평가(제안서평가) 배점 (예: 90 또는 80)",
          nullable: true,
        },
        price_score: {
          type: Type.NUMBER,
          description: "입찰가격평가 배점 (예: 10 또는 20)",
          nullable: true,
        },
      },
      required: ["technical_score", "price_score"],
    },
    participation: {
      type: Type.OBJECT,
      properties: {
        business_type: {
          type: Type.STRING,
          description: "입찰참가등록 업종명 (예: '학술연구용역', '소프트웨어사업자')",
          nullable: true,
        },
        business_code: {
          type: Type.STRING,
          description: "업종코드 (예: '1169')",
          nullable: true,
        },
        sme_restriction: {
          type: Type.STRING,
          description: "중소기업자간 경쟁 또는 참가자격 제한 규정",
          nullable: true,
        },
        joint_contract_allowed: {
          type: Type.BOOLEAN,
          description: "공동수급(공동이행) 허용 여부 (허용: true, 불허: false, 미기재: null)",
          nullable: true,
        },
        subcontract_allowed: {
          type: Type.BOOLEAN,
          description: "하도급 허용 여부 (허용: true, 불허/원칙적불가: false, 미기재: null)",
          nullable: true,
        },
      },
      required: [
        "business_type",
        "business_code",
        "sme_restriction",
        "joint_contract_allowed",
        "subcontract_allowed",
      ],
    },
    governing_law: {
      type: Type.STRING,
      description: "문서에서 확인되는 근거/적용 법령 (예: '국가를 당사자로 하는 계약에 관한 법률 시행령 제43조')",
      nullable: true,
    },
    summary: {
      type: Type.STRING,
      description: "사업 목적 및 주요 과업 범위 2~3줄 요약",
      nullable: true,
    },
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: {
            type: Type.STRING,
            description: "근거 대상 필드명 (예: 'competition_method', 'budget', 'project_name')",
          },
          source: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ["PAGE", "TABLE"],
              },
              page: {
                type: Type.INTEGER,
                description: "PAGE 번호 (type이 PAGE일 때 1-indexed 숫자)",
                nullable: true,
              },
              table_id: {
                type: Type.STRING,
                description: "TABLE ID (type이 TABLE일 때, 예: 'table_1')",
                nullable: true,
              },
            },
            required: ["type"],
          },
          quote: {
            type: Type.STRING,
            description: "canonical.md에 실제로 존재하는 원문 문구 (재작성 금지)",
          },
          status: {
            type: Type.STRING,
            enum: ["EXPLICIT", "INFERRED", "NOT_FOUND"],
          },
        },
        required: ["field", "source", "quote", "status"],
      },
    },
  },
  required: [
    "project_name",
    "ordering_agency",
    "procurement_agency",
    "project_type",
    "project_period",
    "budget",
    "competition_method",
    "award_method",
    "evaluation",
    "participation",
    "governing_law",
    "summary",
    "evidence",
  ],
};

// Maximum token limit for gemini-3.8-flash is 1,048,576 tokens.
// In Korean/mixed text, 1 token is roughly 1.5 ~ 2.5 characters.
// We set a safe character boundary (e.g. 3,500,000 characters ~ 1M tokens) to prevent silent truncation.
export const MAX_CANONICAL_CHARS = 3_500_000;
export const MAX_INPUT_TOKENS_THRESHOLD = 1_000_000;

export function sanitizeParsedMetadata(raw: any): BusinessMetadata {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI가 유효한 객체 형태의 JSON을 반환하지 않았습니다.");
  }

  const project_name =
    typeof raw.project_name === "string" ? raw.project_name.trim() : null;
  const ordering_agency =
    typeof raw.ordering_agency === "string" ? raw.ordering_agency.trim() : null;
  const procurement_agency =
    typeof raw.procurement_agency === "string"
      ? raw.procurement_agency.trim()
      : null;

  const validTypes = [
    "SERVICE",
    "GOODS",
    "CONSTRUCTION",
    "RESEARCH",
    "IT",
    "OTHER",
    "UNKNOWN",
  ] as const;
  const project_type = validTypes.includes(raw.project_type)
    ? raw.project_type
    : "UNKNOWN";

  const project_period_raw =
    raw.project_period && typeof raw.project_period.raw === "string"
      ? raw.project_period.raw.trim()
      : null;

  let budget_amount: number | null = null;
  if (typeof raw.budget?.amount === "number" && !isNaN(raw.budget.amount)) {
    budget_amount = raw.budget.amount;
  } else if (typeof raw.budget?.amount === "string") {
    const parsed = Number(raw.budget.amount.replace(/[^0-9.-]/g, ""));
    budget_amount = !isNaN(parsed) ? parsed : null;
  }

  const budget_currency =
    raw.budget?.currency === "KRW" ? "KRW" : raw.budget?.currency ? "KRW" : null;
  const budget_vat =
    typeof raw.budget?.vat_included === "boolean"
      ? raw.budget.vat_included
      : null;

  const validCompetition = [
    "OPEN_COMPETITIVE",
    "RESTRICTED_COMPETITIVE",
    "NOMINATED_COMPETITIVE",
    "PRIVATE_CONTRACT",
    "UNKNOWN",
  ] as const;
  const competition_method = validCompetition.includes(raw.competition_method)
    ? raw.competition_method
    : "UNKNOWN";

  const validAward = [
    "NEGOTIATION",
    "QUALIFICATION_REVIEW",
    "LOWEST_PRICE",
    "TWO_STAGE",
    "SPEC_PRICE_SIMULTANEOUS",
    "OTHER",
    "UNKNOWN",
  ] as const;
  const award_method = validAward.includes(raw.award_method)
    ? raw.award_method
    : "UNKNOWN";

  const eval_tech =
    typeof raw.evaluation?.technical_score === "number"
      ? raw.evaluation.technical_score
      : null;
  const eval_price =
    typeof raw.evaluation?.price_score === "number"
      ? raw.evaluation.price_score
      : null;

  const part_type =
    typeof raw.participation?.business_type === "string"
      ? raw.participation.business_type.trim()
      : null;
  const part_code =
    typeof raw.participation?.business_code === "string"
      ? raw.participation.business_code.trim()
      : null;
  const part_sme =
    typeof raw.participation?.sme_restriction === "string"
      ? raw.participation.sme_restriction.trim()
      : null;
  const part_joint =
    typeof raw.participation?.joint_contract_allowed === "boolean"
      ? raw.participation.joint_contract_allowed
      : null;
  const part_sub =
    typeof raw.participation?.subcontract_allowed === "boolean"
      ? raw.participation.subcontract_allowed
      : null;

  const governing_law =
    typeof raw.governing_law === "string" ? raw.governing_law.trim() : null;
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : null;

  const evidenceList: MetadataEvidence[] = [];
  if (Array.isArray(raw.evidence)) {
    for (const item of raw.evidence) {
      if (!item || typeof item !== "object") continue;
      const field = typeof item.field === "string" ? item.field : "general";
      const quote = typeof item.quote === "string" ? item.quote.trim() : "";
      const status =
        item.status === "EXPLICIT" ||
        item.status === "INFERRED" ||
        item.status === "NOT_FOUND"
          ? item.status
          : "EXPLICIT";

      let source: MetadataEvidence["source"] = {
        type: "PAGE",
        page: 1,
      };

      if (item.source && typeof item.source === "object") {
        if (item.source.type === "TABLE") {
          source = {
            type: "TABLE",
            table_id: String(item.source.table_id || "table_1"),
          };
        } else {
          source = {
            type: "PAGE",
            page: typeof item.source.page === "number" ? item.source.page : 1,
          };
        }
      }

      evidenceList.push({
        field,
        source,
        quote,
        status,
      });
    }
  }

  return {
    project_name,
    ordering_agency,
    procurement_agency,
    project_type,
    project_period: {
      raw: project_period_raw,
    },
    budget: {
      amount: budget_amount,
      currency: budget_currency,
      vat_included: budget_vat,
    },
    competition_method,
    award_method,
    evaluation: {
      technical_score: eval_tech,
      price_score: eval_price,
    },
    participation: {
      business_type: part_type,
      business_code: part_code,
      sme_restriction: part_sme,
      joint_contract_allowed: part_joint,
      subcontract_allowed: part_sub,
    },
    governing_law,
    summary,
    evidence: evidenceList,
  };
}

export async function extractBusinessMetadataFromCanonical(
  canonicalMarkdown: string,
  options?: {
    model?: string;
    apiKey?: string;
  }
): Promise<ExtractMetadataResponse> {
  const startTime = Date.now();

  // 1. Validation of input
  if (!canonicalMarkdown || typeof canonicalMarkdown !== "string" || !canonicalMarkdown.trim()) {
    return {
      success: false,
      error: "canonical_markdown이 제공되지 않았습니다.",
      error_code: "INVALID_INPUT",
      duration_ms: Date.now() - startTime,
    };
  }

  // 2. Context limit strict check: Never truncate silently!
  if (canonicalMarkdown.length > MAX_CANONICAL_CHARS) {
    return {
      success: false,
      error: "현재 모델의 입력 한도를 초과했습니다.",
      error_code: "DOCUMENT_TOO_LARGE",
      duration_ms: Date.now() - startTime,
    };
  }

  // 3. API Key check
  const apiKey =
    options?.apiKey !== undefined
      ? options.apiKey
      : process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

  if (!apiKey || !apiKey.trim() || apiKey === "MY_GEMINI_API_KEY") {
    return {
      success: false,
      error: "GEMINI_API_KEY 또는 AI_API_KEY 환경변수가 설정되지 않았습니다.",
      error_code: "MISSING_API_KEY",
      duration_ms: Date.now() - startTime,
    };
  }

  const modelName =
    options?.model ||
    process.env.AI_MODEL ||
    "gemini-flash-latest";

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    // Count tokens before generation to ensure it does not exceed context window
    try {
      const tokenCountResp = await ai.models.countTokens({
        model: modelName,
        contents: canonicalMarkdown,
      });
      if (
        tokenCountResp.totalTokens &&
        tokenCountResp.totalTokens > MAX_INPUT_TOKENS_THRESHOLD
      ) {
        return {
          success: false,
          error: "현재 모델의 입력 한도를 초과했습니다.",
          error_code: "DOCUMENT_TOO_LARGE",
          duration_ms: Date.now() - startTime,
        };
      }
    } catch {
      // If countTokens fails for any non-fatal network reason, continue with length guard
    }

    // Call LLM (with fallback on transient 503 high demand spikes)
    let response;
    let usedModel = modelName;
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: canonicalMarkdown,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: BUSINESS_METADATA_SCHEMA,
        },
      });
    } catch (callErr: unknown) {
      const errMsg = callErr instanceof Error ? callErr.message : String(callErr);
      if (
        errMsg.includes("503") ||
        errMsg.includes("UNAVAILABLE") ||
        errMsg.includes("high demand")
      ) {
        usedModel =
          modelName === "gemini-flash-latest"
            ? "gemini-3.1-flash-lite"
            : "gemini-flash-latest";
        response = await ai.models.generateContent({
          model: usedModel,
          contents: canonicalMarkdown,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: BUSINESS_METADATA_SCHEMA,
          },
        });
      } else {
        throw callErr;
      }
    }

    const duration_ms = Date.now() - startTime;
    const rawText = response.text?.trim() || "";

    if (!rawText) {
      return {
        success: false,
        error: "AI 모델이 빈 응답을 반환했습니다.",
        error_code: "AI_REQUEST_FAILED",
        duration_ms,
      };
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (parseErr: unknown) {
      return {
        success: false,
        error: `AI가 유효한 JSON을 반환하지 못했습니다: ${
          parseErr instanceof Error ? parseErr.message : String(parseErr)
        }`,
        error_code: "JSON_PARSE_ERROR",
        duration_ms,
      };
    }

    const metadata = sanitizeParsedMetadata(parsedJson);

    // Extract token usage
    const input_tokens =
      response.usageMetadata?.promptTokenCount ||
      Math.round(canonicalMarkdown.length / 3);
    const output_tokens =
      response.usageMetadata?.candidatesTokenCount ||
      Math.round(rawText.length / 3);

    return {
      success: true,
      model: usedModel,
      metadata,
      usage: {
        input_tokens,
        output_tokens,
      },
      duration_ms,
    };
  } catch (err: unknown) {
    const duration_ms = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);

    // Check if error is context window exceeded
    if (
      msg.includes("429") ||
      msg.includes("ResourceExhausted") ||
      msg.includes("token limit") ||
      msg.includes("context length")
    ) {
      return {
        success: false,
        error: "현재 모델의 입력 한도를 초과했습니다.",
        error_code: "DOCUMENT_TOO_LARGE",
        duration_ms,
      };
    }

    return {
      success: false,
      error: `AI 요청 실패: ${msg}`,
      error_code: "AI_REQUEST_FAILED",
      duration_ms,
    };
  }
}
