import OpenAI from "openai";
import { NextResponse } from "next/server";
import { fallbackGroupIdea } from "@/lib/ideaGrouping";
import type { AssistantItem } from "@/types/assistant";

const IDEA_GROUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    ideaGroupId: {
      type: "string",
    },
    ideaGroupTitle: {
      type: "string",
    },
    ideaSubcategory: {
      type: "string",
    },
    matchedExisting: {
      type: "boolean",
    },
  },
  required: [
    "ideaGroupId",
    "ideaGroupTitle",
    "ideaSubcategory",
    "matchedExisting",
  ],
};

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  const personalAiContext = String(body.personalAiContext ?? "")
    .trim()
    .slice(0, 3000);
  const existingIdeas = Array.isArray(body.existingIdeas)
    ? (body.existingIdeas as AssistantItem[])
    : [];

  if (!text) {
    return NextResponse.json({ error: "아이디어 내용이 없습니다." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      fallbackGroupIdea({
        text,
        existingIdeas,
      })
    );
  }

  try {
    const fallbackResult = fallbackGroupIdea({
      text,
      existingIdeas,
    });
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `
너는 개인 비서 앱의 아이디어 정리 담당이다.
새 아이디어가 기존 아이디어 주제와 이어지는지 판단해서 JSON으로만 답해라.
${personalAiContext ? `\n${personalAiContext}\n` : ""}

판단 기준:
- 같은 제품/기능/프로젝트/소재를 다시 언급하면 기존 ideaGroupId를 사용한다.
- 예: "오답 포스트잇 만들기" 이후 "포스트잇 이렇게 제작하면 좋을듯"은 같은 그룹이다.
- 기존 주제와 명확히 다르면 새 그룹을 만든다.
- ideaSubcategory는 "제작", "디자인", "기능", "운영", "자료", "기타"처럼 짧게 정한다.
- 애매하면 fallback 후보를 참고하되, 너무 억지로 붙이지 않는다.

fallback 후보:
${JSON.stringify(fallbackResult)}
          `.trim(),
        },
        {
          role: "user",
          content: JSON.stringify({
            newIdea: text,
            existingIdeas,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "idea_grouping",
          strict: true,
          schema: IDEA_GROUP_SCHEMA,
        },
      },
    });

    return NextResponse.json(JSON.parse(response.output_text));
  } catch (error) {
    console.error("아이디어 AI 묶음 실패:", error);

    return NextResponse.json(
      fallbackGroupIdea({
        text,
        existingIdeas,
      })
    );
  }
}
