"use client";

import { useRef, useState } from "react";
import { STORAGE_CATALOG } from "@/lib/storageCatalog";

type LocalBackupFile = {
  app: "my-secretary";
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
};

const BACKUP_FILE_NAME = "my-secretary-local-backup.json";

function readLocalValue(key: string) {
  const rawValue = window.localStorage.getItem(key);

  if (rawValue === null) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

function writeLocalValue(key: string, value: unknown) {
  if (value === null || value === undefined) {
    window.localStorage.removeItem(key);
    return;
  }

  if (typeof value === "string") {
    window.localStorage.setItem(key, value);
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export default function LocalDataTransfer() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleExport() {
    const data = STORAGE_CATALOG.reduce<Record<string, unknown>>(
      (nextData, item) => {
        nextData[item.localStorageKey] = readLocalValue(item.localStorageKey);
        return nextData;
      },
      {}
    );
    const backup: LocalBackupFile = {
      app: "my-secretary",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = BACKUP_FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("현재 기기의 로컬 데이터를 백업 파일로 만들었습니다.");
  }

  async function handleImport(file: File | null) {
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text) as LocalBackupFile;

      if (backup.app !== "my-secretary" || backup.version !== 1) {
        setMessage("나의 비서 백업 파일 형식이 아닙니다.");
        return;
      }

      STORAGE_CATALOG.forEach((item) => {
        if (item.localStorageKey in backup.data) {
          writeLocalValue(item.localStorageKey, backup.data[item.localStorageKey]);
        }
      });

      setMessage("백업 데이터를 이 기기에 가져왔습니다. 화면을 새로고침하면 반영됩니다.");
    } catch {
      setMessage("백업 파일을 읽지 못했습니다.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-blue-600">로컬 데이터 이전</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            휴대폰 테스트용 백업
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            DB 저장소 전환 전까지는 이 기기의 기록과 일정이 브라우저에
            저장됩니다. 필요할 때 백업 파일로 다른 기기에 옮길 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-700"
        >
          백업 파일 만들기
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
        >
          백업 가져오기
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => handleImport(event.target.files?.[0] ?? null)}
      />

      {message && (
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-500 ring-1 ring-slate-100">
          {message}
        </p>
      )}
    </section>
  );
}
