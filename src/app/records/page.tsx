"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import ItemCard from "@/components/ItemCard";
import UserStatusBadge from "@/components/UserStatusBadge";
import { groupIdeaWithAi, isIdeaRecord } from "@/lib/ideaGrouping";
import { deleteItem, getItems, saveItem, updateItem } from "@/lib/storage";
import { AssistantItem } from "@/types/assistant";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createIdeaTitle(text: string) {
  const trimmedText = text.trim();

  if (trimmedText.length <= 28) {
    return trimmedText;
  }

  return `${trimmedText.slice(0, 28)}...`;
}

export default function RecordsPage() {
  const [items, setItems] = useState<AssistantItem[]>([]);
  const [ideaText, setIdeaText] = useState("");
  const [isOrganizingIdea, setIsOrganizingIdea] = useState(false);
  const [ideaMessage, setIdeaMessage] = useState<string | null>(null);

  useEffect(() => {
    setItems(getItems());
  }, []);

  const ideaItems = useMemo(() => {
    return items
      .filter(isIdeaRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items]);

  const groupedIdeaItems = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        id: string;
        title: string;
        items: AssistantItem[];
      }
    >();

    ideaItems.forEach((item) => {
      const groupId = item.ideaGroupId ?? item.id;
      const groupTitle = item.ideaGroupTitle ?? item.title;
      const group = groupMap.get(groupId) ?? {
        id: groupId,
        title: groupTitle,
        items: [],
      };

      group.items.push(item);
      groupMap.set(groupId, group);
    });

    return Array.from(groupMap.values()).sort((a, b) => {
      const aLatest = a.items[0]?.createdAt ?? "";
      const bLatest = b.items[0]?.createdAt ?? "";
      return bLatest.localeCompare(aLatest);
    });
  }, [ideaItems]);

  async function handleSaveIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedText = ideaText.trim();

    if (!trimmedText) {
      alert("기록할 아이디어를 입력해줘.");
      return;
    }

    setIsOrganizingIdea(true);
    setIdeaMessage(null);

    const grouping = await groupIdeaWithAi({
      text: trimmedText,
      existingIdeas: items,
    });
    const now = new Date().toISOString();
    const newItem: AssistantItem = {
      id: createId(),
      originalText: trimmedText,
      title: createIdeaTitle(trimmedText),
      category: "기타",
      actionType: "아이디어",
      processType: "아이디어",
      priority: "보통",
      repeatType: "일회성",
      status: "미완료",
      estimatedMinutes: null,
      dueDate: null,
      reminderDate: null,
      ideaGroupId: grouping.ideaGroupId,
      ideaGroupTitle: grouping.ideaGroupTitle,
      ideaSubcategory: grouping.ideaSubcategory,
      createdAt: now,
      updatedAt: now,
    };

    saveItem(newItem);
    setItems(getItems());
    setIdeaText("");
    setIdeaMessage(
      grouping.matchedExisting
        ? `"${grouping.ideaGroupTitle}" 주제에 이어서 저장했어.`
        : `"${grouping.ideaGroupTitle}" 새 주제로 저장했어.`
    );
    setIsOrganizingIdea(false);
  }

  function handleComplete(item: AssistantItem) {
    updateItem({
      ...item,
      status: "완료",
      updatedAt: new Date().toISOString(),
    });
    setItems(getItems());
  }

  function handleDelete(id: string) {
    deleteItem(id);
    setItems(getItems());
  }

  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            아이디어 기록
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            아직 일정이나 할 일로 정리하지 않을 생각과 메모를 한곳에
            이어서 남깁니다.
          </p>
        </div>
        <UserStatusBadge />
      </header>

      <section className="app-card p-5">
        <form onSubmit={handleSaveIdea} className="space-y-3">
          <textarea
            value={ideaText}
            onChange={(event) => setIdeaText(event.target.value)}
            placeholder="떠오른 아이디어를 적어보세요"
            className="min-h-32 w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-6 outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={isOrganizingIdea}
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:bg-slate-300"
          >
            {isOrganizingIdea ? "아이디어 정리 중" : "아이디어 저장"}
          </button>
          {ideaMessage && (
            <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
              {ideaMessage}
            </p>
          )}
        </form>
      </section>

      <section className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">저장된 아이디어</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
            {ideaItems.length}개
          </span>
        </div>

        {ideaItems.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-sm font-semibold leading-6 text-slate-500 shadow-soft ring-1 ring-slate-100">
            아직 저장된 아이디어가 없습니다.
          </p>
        ) : (
          groupedIdeaItems.map((group) => (
            <article
              key={group.id}
              className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-950">
                    {group.title}
                  </h3>
                  <p className="mt-1 text-xs font-black text-slate-400">
                    {group.items.length}개의 연결된 기록
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                  {group.items[0]?.ideaSubcategory ?? "아이디어"}
                </span>
              </div>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </article>
          ))
        )}
      </section>

      <BottomNavigation />
    </main>
  );
}
