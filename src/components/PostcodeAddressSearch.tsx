"use client";

import { useEffect, useState } from "react";

type DaumPostcodeData = {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: "Y" | "N";
};

type DaumPostcodeConstructor = new (options: {
  oncomplete: (data: DaumPostcodeData) => void;
}) => {
  open: () => void;
};

declare global {
  interface Window {
    daum?: {
      Postcode?: DaumPostcodeConstructor;
    };
  }
}

type PostcodeAddressSearchProps = {
  label?: string;
  buttonLabel?: string;
  onSelect: (result: {
    address: string;
    postalCode: string;
    detailHint: string;
  }) => void;
};

const POSTCODE_SCRIPT_ID = "daum-postcode-script";
const POSTCODE_SCRIPT_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

function loadPostcodeScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("window is unavailable"));
      return;
    }

    if (window.daum?.Postcode) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(POSTCODE_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("postcode script failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = POSTCODE_SCRIPT_ID;
    script.src = POSTCODE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("postcode script failed"));
    document.head.appendChild(script);
  });
}

function getAddress(data: DaumPostcodeData) {
  return data.roadAddress || data.address || data.jibunAddress;
}

function getDetailHint(data: DaumPostcodeData) {
  const hints = [
    data.buildingName,
    data.apartment === "Y" ? "공동주택" : "",
  ].filter(Boolean);

  return hints.join(", ");
}

export default function PostcodeAddressSearch({
  label = "주소 검색",
  buttonLabel = "우편번호 검색",
  onSelect,
}: PostcodeAddressSearchProps) {
  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPostcodeScript()
      .then(() => {
        setIsReady(true);
      })
      .catch(() => {
        setMessage("주소 검색을 불러오지 못했습니다. 다시 시도해주세요.");
      });
  }, []);

  async function handleOpen() {
    setMessage(null);

    try {
      await loadPostcodeScript();
      const Postcode = window.daum?.Postcode;

      if (!Postcode) {
        setMessage("주소 검색을 시작하지 못했습니다.");
        return;
      }

      new Postcode({
        oncomplete(data) {
          onSelect({
            address: getAddress(data),
            postalCode: data.zonecode,
            detailHint: getDetailHint(data),
          });
        },
      }).open();
    } catch {
      setMessage("주소 검색을 열지 못했습니다.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)] transition hover:bg-blue-500 disabled:bg-slate-300"
      >
        {isReady ? buttonLabel : `${label} 준비 중`}
      </button>
      {message && (
        <p className="mt-2 rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-700 ring-1 ring-amber-100">
          {message}
        </p>
      )}
    </div>
  );
}
