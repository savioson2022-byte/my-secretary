import type { AssistantItem } from "@/types/assistant";
import { formatPersonalAiMemoryForPrompt } from "@/lib/personalAiMemoryStorage";
import type { PersonalAiMemory } from "@/types/personalAi";
import { runGemmaOnDevice } from "@/lib/local-ai/gemmaAdapter";

export type IdeaGroupingResult = {
  ideaGroupId: string;
  ideaGroupTitle: string;
  ideaSubcategory: string;
  matchedExisting: boolean;
};

export function shouldAttachToIdeaRecord(item: Pick<AssistantItem, "processType">) {
  return item.processType === "메모" || item.processType === "아이디어";
}

export function isIdeaRecord(item: AssistantItem) {
  return (
    item.processType === "아이디어" ||
    (item.processType === "메모" && Boolean(item.ideaGroupId))
  );
}

function normalizeText(text: string) {
  return text.trim().toLowerCase();
}

function getKeywords(text: string) {
  return Array.from(
    new Set(
      normalizeText(text)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 2)
    )
  );
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createIdeaTitle(text: string) {
  const trimmedText = text.trim();
  return trimmedText.length <= 28 ? trimmedText : `${trimmedText.slice(0, 28)}...`;
}

export function fallbackGroupIdea({
  text,
  existingIdeas,
}: {
  text: string;
  existingIdeas: AssistantItem[];
}): IdeaGroupingResult {
  const keywords = getKeywords(text);
  const candidates = existingIdeas
    .filter(isIdeaRecord)
    .map((item) => {
      const targetKeywords = getKeywords(
        `${item.title} ${item.originalText} ${item.ideaGroupTitle ?? ""}`
      );
      const overlap = keywords.filter((keyword) =>
        targetKeywords.includes(keyword)
      );

      return {
        item,
        score: overlap.length,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const bestCandidate = candidates[0];

  if (bestCandidate && bestCandidate.score >= 1) {
    return {
      ideaGroupId: bestCandidate.item.ideaGroupId ?? bestCandidate.item.id,
      ideaGroupTitle:
        bestCandidate.item.ideaGroupTitle ?? bestCandidate.item.title,
      ideaSubcategory:
        bestCandidate.item.ideaSubcategory ?? keywords[0] ?? "메모",
      matchedExisting: true,
    };
  }

  return {
    ideaGroupId: createId(),
    ideaGroupTitle: createIdeaTitle(text),
    ideaSubcategory: keywords[0] ?? "아이디어",
    matchedExisting: false,
  };
}

export async function groupIdeaWithAi({
  text,
  existingIdeas,
  personalAiMemories = [],
}: {
  text: string;
  existingIdeas: AssistantItem[];
  personalAiMemories?: PersonalAiMemory[];
}): Promise<IdeaGroupingResult> {
  const fallbackResult = fallbackGroupIdea({ text, existingIdeas });
  const personalAiContext = formatPersonalAiMemoryForPrompt({
    memories: personalAiMemories,
    domains: ["idea"],
  });

  try {
    const localResult = await runGemmaOnDevice<
      { text: string; existingIdeas: AssistantItem[] },
      IdeaGroupingResult
    >({
      capability: "group_idea",
      input: {
        text,
        existingIdeas: existingIdeas.filter(isIdeaRecord).slice(0, 40),
      },
      memories: personalAiMemories,
    });

    if (localResult.ok && localResult.output) {
      return localResult.output;
    }

    const response = await fetch("/api/ideas/group", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        personalAiContext,
        existingIdeas: existingIdeas
          .filter(isIdeaRecord)
          .slice(0, 40)
          .map((item) => ({
            id: item.id,
            title: item.title,
            originalText: item.originalText,
            ideaGroupId: item.ideaGroupId ?? item.id,
            ideaGroupTitle: item.ideaGroupTitle ?? item.title,
            ideaSubcategory: item.ideaSubcategory ?? null,
          })),
      }),
    });

    if (!response.ok) {
      return fallbackResult;
    }

    const data = (await response.json()) as Partial<IdeaGroupingResult>;

    if (!data.ideaGroupId || !data.ideaGroupTitle || !data.ideaSubcategory) {
      return fallbackResult;
    }

    return {
      ideaGroupId: data.ideaGroupId,
      ideaGroupTitle: data.ideaGroupTitle,
      ideaSubcategory: data.ideaSubcategory,
      matchedExisting: Boolean(data.matchedExisting),
    };
  } catch {
    return fallbackResult;
  }
}
