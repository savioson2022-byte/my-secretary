import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  parseCoupangOrderMailFallback,
  type MailImportCandidate,
} from "@/lib/purchaseMailImport";

const PURCHASE_IMPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          productName: { type: "string" },
          productUrl: { type: "string" },
          priceText: { type: ["string", "null"] },
          quantityText: { type: ["string", "null"] },
          orderDateText: { type: ["string", "null"] },
          confidence: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          reason: { type: "string" },
        },
        required: [
          "id",
          "productName",
          "productUrl",
          "priceText",
          "quantityText",
          "orderDateText",
          "confidence",
          "reason",
        ],
      },
    },
  },
  required: ["candidates"],
};

function normalizeAiCandidates(
  candidates: MailImportCandidate[]
): MailImportCandidate[] {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      id: candidate.id || `ai-${index}`,
      productName: candidate.productName.trim(),
      productUrl: candidate.productUrl?.trim() ?? "",
      priceText: candidate.priceText || null,
      quantityText: candidate.quantityText || null,
      orderDateText: candidate.orderDateText || null,
      confidence: candidate.confidence ?? "medium",
      reason: candidate.reason || "AI가 구매 상세정보에서 상품 후보로 판단했습니다.",
    }))
    .filter((candidate) => candidate.productName.length > 0)
    .slice(0, 8);
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim().slice(0, 12000);

  if (!text) {
    return NextResponse.json(
      {
        error: "분석할 주문 메일 내용이 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      candidates: parseCoupangOrderMailFallback(text),
      source: "fallback",
    });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `
너는 개인 비서 앱의 구매 내역 추출기다.

사용자가 네이버 메일, Gmail, 쿠팡 주문 상세정보, 주문 확인 메일, 영수증 텍스트를 붙여넣는다.
본문에는 메일 UI, 검색 UI, 답장/전달/삭제 버튼, 광고, 배송 안내, 결제 안내 같은 잡음이 섞일 수 있다.

해야 할 일:
- 실제 구매 상품만 candidates에 넣어라.
- "검색결과", "뒤로 가기", "메일 검색", "전체답장", "배송조회", "주문번호" 같은 UI/상태 문구는 절대 상품으로 넣지 마라.
- 상품 본품이 아닌 "염색약 통", "브러시", "장갑"처럼 사용자가 원한 본품과 다른 부속품은 본문상 실제 구매 상품으로 보일 때만 넣어라.
- 쿠팡 주문 상세정보에 있는 상품명, 옵션, 수량, 가격, 주문일을 최대한 보존해라.
- 상품명은 사용자가 나중에 재구매할 수 있을 정도로 구체적으로 정리해라.
- 상품 URL이 본문에 있으면 productUrl에 넣고, 없으면 빈 문자열로 둬라.
- 가격/수량/주문일을 모르면 null로 둬라.
- 확실하면 confidence는 high, 애매하면 medium, 화면 잡음에서 추정한 정도면 low로 둬라.
          `.trim(),
        },
        {
          role: "user",
          content: text,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "purchase_mail_import",
          strict: true,
          schema: PURCHASE_IMPORT_SCHEMA,
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as {
      candidates: MailImportCandidate[];
    };
    const candidates = normalizeAiCandidates(parsed.candidates);

    return NextResponse.json({
      candidates,
      source: "ai",
    });
  } catch (error) {
    console.error("구매 메일 AI 분석 실패:", error);

    return NextResponse.json({
      candidates: parseCoupangOrderMailFallback(text),
      source: "fallback",
    });
  }
}

