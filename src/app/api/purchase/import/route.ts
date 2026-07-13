import { NextResponse } from "next/server";
import { importPurchaseMailText } from "@/lib/purchaseMailAi";

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

  const result = await importPurchaseMailText(text);

  return NextResponse.json(result);
}
