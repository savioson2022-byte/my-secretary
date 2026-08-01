import { NextResponse } from "next/server";
import { importPurchaseMailText } from "@/lib/purchaseMailAi";
import { verifyAiDataConsent } from "@/lib/serverAiDataConsent";

export async function POST(request: Request) {
  if (!(await verifyAiDataConsent(request))) {
    return NextResponse.json({ error: "외부 AI 전송 동의가 필요합니다." }, { status: 403 });
  }
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

  const result = await importPurchaseMailText(text);

  return NextResponse.json(result);
}
