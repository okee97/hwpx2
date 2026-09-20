import assert from "node:assert/strict";
import {
  sanitizeParsedMetadata,
  extractBusinessMetadataFromCanonical,
  MAX_CANONICAL_CHARS,
} from "../server/gemini-metadata.ts";
import { BusinessMetadata } from "../src/types.ts";

console.log("==================================================");
console.log("[TEST] AI Business Metadata Extractor 단위/통합 테스트 (10개 시나리오)");
console.log("==================================================");

let passedCount = 0;
let failedCount = 0;

async function runAsyncTest(testName: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✓ [PASS] ${testName}`);
    passedCount++;
  } catch (err: any) {
    console.error(`✗ [FAIL] ${testName}:`, err.message);
    failedCount++;
  }
}

async function main() {
  // TEST 1: 정상 JSON Parsing
  await runAsyncTest("TEST 1: 정상 JSON Parsing (모든 정상 필드 역직렬화)", () => {
    const rawMock = {
      project_name: "소상공인실태조사 고도화 연구 용역",
      ordering_agency: "소상공인시장진흥공단",
      procurement_agency: null,
      project_type: "RESEARCH",
      project_period: {
        raw: "계약체결일로부터 ~ ‘26. 12. 31",
      },
      budget: {
        amount: 49993000,
        currency: "KRW",
        vat_included: true,
      },
      competition_method: "RESTRICTED_COMPETITIVE",
      award_method: "NEGOTIATION",
      evaluation: {
        technical_score: 90,
        price_score: 10,
      },
      participation: {
        business_type: "학술연구용역",
        business_code: "1169",
        sme_restriction: "소기업·소상공인확인서 소지업체",
        joint_contract_allowed: false,
        subcontract_allowed: false,
      },
      governing_law: "국가를 당사자로 하는 계약에 관한 법률 시행령 제43조",
      summary: "소상공인 실태조사 표본 및 조사표 체계를 고도화하기 위한 학술연구",
      evidence: [
        {
          field: "project_name",
          source: { type: "PAGE", page: 1 },
          quote: "과업명: 소상공인실태조사 고도화 연구 용역",
          status: "EXPLICIT",
        },
      ],
    };

    const parsed = sanitizeParsedMetadata(rawMock);
    assert.equal(parsed.project_name, "소상공인실태조사 고도화 연구 용역");
    assert.equal(parsed.ordering_agency, "소상공인시장진흥공단");
    assert.equal(parsed.project_type, "RESEARCH");
    assert.equal(parsed.budget.amount, 49993000);
    assert.equal(parsed.budget.vat_included, true);
    assert.equal(parsed.competition_method, "RESTRICTED_COMPETITIVE");
    assert.equal(parsed.award_method, "NEGOTIATION");
    assert.equal(parsed.evaluation.technical_score, 90);
    assert.equal(parsed.evaluation.price_score, 10);
    assert.equal(parsed.participation.joint_contract_allowed, false);
    assert.equal(parsed.participation.subcontract_allowed, false);
    assert.equal(parsed.evidence.length, 1);
    assert.equal(parsed.evidence[0].source.type, "PAGE");
  });

  // TEST 2: null 값 허용
  await runAsyncTest("TEST 2: null 값 허용 (미확인 정보는 누락/임의생성 대신 null 유지)", () => {
    const rawMock = {
      project_name: null,
      ordering_agency: null,
      procurement_agency: null,
      project_type: "UNKNOWN",
      project_period: { raw: null },
      budget: { amount: null, currency: null, vat_included: null },
      competition_method: "UNKNOWN",
      award_method: "UNKNOWN",
      evaluation: { technical_score: null, price_score: null },
      participation: {
        business_type: null,
        business_code: null,
        sme_restriction: null,
        joint_contract_allowed: null,
        subcontract_allowed: null,
      },
      governing_law: null,
      summary: null,
      evidence: [],
    };

    const parsed = sanitizeParsedMetadata(rawMock);
    assert.equal(parsed.project_name, null);
    assert.equal(parsed.ordering_agency, null);
    assert.equal(parsed.procurement_agency, null);
    assert.equal(parsed.budget.amount, null);
    assert.equal(parsed.budget.vat_included, null);
    assert.equal(parsed.evaluation.technical_score, null);
    assert.equal(parsed.participation.joint_contract_allowed, null);
    assert.equal(parsed.governing_law, null);
  });

  // TEST 3: UNKNOWN enum 허용
  await runAsyncTest("TEST 3: UNKNOWN enum 허용 (확인 불가능한 계약방식/유형의 UNKNOWN 정상 처리)", () => {
    const rawMock = {
      project_type: "UNKNOWN",
      competition_method: "UNKNOWN",
      award_method: "UNKNOWN",
      budget: { amount: null, currency: null, vat_included: null },
      project_period: { raw: null },
      evaluation: { technical_score: null, price_score: null },
      participation: {
        business_type: null,
        business_code: null,
        sme_restriction: null,
        joint_contract_allowed: null,
        subcontract_allowed: null,
      },
      evidence: [],
    };

    const parsed = sanitizeParsedMetadata(rawMock);
    assert.equal(parsed.project_type, "UNKNOWN");
    assert.equal(parsed.competition_method, "UNKNOWN");
    assert.equal(parsed.award_method, "UNKNOWN");
  });

  // TEST 4: competition_method와 award_method가 별도 필드인지 확인
  await runAsyncTest("TEST 4: competition_method와 award_method가 별도 필드인지 확인 (경쟁방법과 낙찰방법 분리)", () => {
    const rawMock = {
      competition_method: "RESTRICTED_COMPETITIVE",
      award_method: "NEGOTIATION",
      budget: { amount: 50000000, currency: "KRW", vat_included: true },
      project_period: { raw: "2026.01.01 ~ 2026.12.31" },
      evaluation: { technical_score: 80, price_score: 20 },
      participation: {
        business_type: null,
        business_code: null,
        sme_restriction: null,
        joint_contract_allowed: null,
        subcontract_allowed: null,
      },
      evidence: [],
    };

    const parsed = sanitizeParsedMetadata(rawMock);
    assert.equal(parsed.competition_method, "RESTRICTED_COMPETITIVE");
    assert.equal(parsed.award_method, "NEGOTIATION");
    assert.notEqual(parsed.competition_method, parsed.award_method);
  });

  // TEST 5: budget.amount가 number인지 확인
  await runAsyncTest("TEST 5: budget.amount가 number인지 확인 (문자열 '49,993,000원' 또는 숫자 모두 number로 정규화)", () => {
    const numericMock = {
      budget: { amount: 49993000, currency: "KRW", vat_included: true },
      project_period: { raw: null },
      evaluation: { technical_score: null, price_score: null },
      participation: {
        business_type: null,
        business_code: null,
        sme_restriction: null,
        joint_contract_allowed: null,
        subcontract_allowed: null,
      },
      evidence: [],
    };
    const parsed1 = sanitizeParsedMetadata(numericMock);
    assert.equal(typeof parsed1.budget.amount, "number");
    assert.equal(parsed1.budget.amount, 49993000);

    const stringMock = {
      budget: { amount: "49,993,000원", currency: "KRW", vat_included: true },
      project_period: { raw: null },
      evaluation: { technical_score: null, price_score: null },
      participation: {
        business_type: null,
        business_code: null,
        sme_restriction: null,
        joint_contract_allowed: null,
        subcontract_allowed: null,
      },
      evidence: [],
    };
    const parsed2 = sanitizeParsedMetadata(stringMock);
    assert.equal(typeof parsed2.budget.amount, "number");
    assert.equal(parsed2.budget.amount, 49993000);
  });

  // TEST 6: Evidence의 page/table source schema 확인
  await runAsyncTest("TEST 6: Evidence의 page/table source schema 확인", () => {
    const rawMock = {
      project_period: { raw: null },
      budget: { amount: null, currency: null, vat_included: null },
      evaluation: { technical_score: null, price_score: null },
      participation: {
        business_type: null,
        business_code: null,
        sme_restriction: null,
        joint_contract_allowed: null,
        subcontract_allowed: null,
      },
      evidence: [
        {
          field: "competition_method",
          source: { type: "PAGE", page: 3 },
          quote: "추진방법 : 제한경쟁입찰(협상에 의한 계약)",
          status: "EXPLICIT",
        },
        {
          field: "evaluation",
          source: { type: "TABLE", table_id: "table_2" },
          quote: "기술능력평가 90점, 입찰가격평가 10점",
          status: "EXPLICIT",
        },
      ],
    };

    const parsed = sanitizeParsedMetadata(rawMock);
    assert.equal(parsed.evidence.length, 2);
    assert.equal(parsed.evidence[0].source.type, "PAGE");
    if (parsed.evidence[0].source.type === "PAGE") {
      assert.equal(parsed.evidence[0].source.page, 3);
    }
    assert.equal(parsed.evidence[1].source.type, "TABLE");
    if (parsed.evidence[1].source.type === "TABLE") {
      assert.equal(parsed.evidence[1].source.table_id, "table_2");
    }
  });

  // TEST 7: AI가 잘못된 JSON을 반환할 경우 앱이 crash하지 않고 명확한 오류 반환
  await runAsyncTest("TEST 7: AI가 잘못된 JSON을 반환할 경우 앱이 crash하지 않고 명확한 오류 반환", () => {
    assert.throws(
      () => {
        sanitizeParsedMetadata("invalid-non-object-string");
      },
      /AI가 유효한 객체 형태의 JSON을 반환하지 않았습니다/,
      "비객체 JSON 입력 시 명확한 에러 발생해야 함"
    );

    assert.throws(
      () => {
        sanitizeParsedMetadata(null);
      },
      /AI가 유효한 객체 형태의 JSON을 반환하지 않았습니다/
    );
  });

  // TEST 8: API Key 없음 -> 명확한 설정 오류
  await runAsyncTest("TEST 8: API Key 없음 (명확한 설정 오류 MISSING_API_KEY 반환)", async () => {
    const res = await extractBusinessMetadataFromCanonical(
      "# DOCUMENT TEXT\n과업명: 테스트 용역",
      { apiKey: "" } // explicitly empty API key
    );

    assert.equal(res.success, false);
    assert.equal(res.error_code, "MISSING_API_KEY");
    assert.match(res.error || "", /GEMINI_API_KEY 또는 AI_API_KEY 환경변수가 설정되지 않았습니다/);
  });

  // TEST 9: Canonical Document 없음 -> 400 error
  await runAsyncTest("TEST 9: Canonical Document 없음 (INVALID_INPUT 반환)", async () => {
    const res1 = await extractBusinessMetadataFromCanonical("");
    assert.equal(res1.success, false);
    assert.equal(res1.error_code, "INVALID_INPUT");

    const res2 = await extractBusinessMetadataFromCanonical("   ");
    assert.equal(res2.success, false);
    assert.equal(res2.error_code, "INVALID_INPUT");
  });

  // TEST 10: 문서 Context 초과 -> 몰래 truncate하지 않고 DOCUMENT_TOO_LARGE
  await runAsyncTest("TEST 10: 문서 Context 초과 (몰래 truncate하지 않고 DOCUMENT_TOO_LARGE 에러 반환)", async () => {
    // Construct a canonical document larger than MAX_CANONICAL_CHARS
    const hugeMarkdown = "A".repeat(MAX_CANONICAL_CHARS + 100);
    const res = await extractBusinessMetadataFromCanonical(hugeMarkdown);

    assert.equal(res.success, false);
    assert.equal(res.error_code, "DOCUMENT_TOO_LARGE");
    assert.match(res.error || "", /현재 모델의 입력 한도를 초과했습니다/);
  });

  console.log("==================================================");
  console.log(`테스트 결과: 총 ${passedCount + failedCount}개 중 통과 ${passedCount}개, 실패 ${failedCount}개`);
  console.log("==================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("테스트 실행 중 예외 발생:", err);
  process.exit(1);
});
