"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import ItemCard from "@/components/ItemCard";
import UserStatusBadge from "@/components/UserStatusBadge";
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

  useEffect(() => {
    setItems(getItems());
  }, []);

  const ideaItems = useMemo(() => {
    return items
      .filter((item) => item.processType === "아이디어")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items]);

  function handleSaveIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedText = ideaText.trim();

    if (!trimmedText) {
      alert("기록할 아이디어를 입력해줘.");
      return;
    }

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
      createdAt: now,
      updatedAt: now,
    };

    saveItem(newItem);
    setItems(getItems());
    setIdeaText("");
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
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 pb-24">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            아이디어 기록
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            아직 일정이나 할 일로 정리하지 않을 생각을 빠르게 남깁니다.
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
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
          >
            아이디어 저장
          </button>
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
          ideaItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
          ))
        )}
      </section>

      <BottomNavigation />
    </main>
  );
}
