"use client";

import { useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storageKeys";

type InputBoxProps = {
  value: string;
  onChange: (value: string) => void;
  onClassify: (textOverride?: string) => void;
  onVoiceCaptureComplete?: (text: string) => void;
  voiceIntent?: boolean;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onaudioend?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onerror:
    | ((event: {
        error: string;
      }) => void)
    | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function appendTranscript(currentText: string, transcript: string) {
  const trimmedTranscript = transcript.trim();

  if (!trimmedTranscript) {
    return currentText;
  }

  const trimmedCurrentText = currentText.trim();

  if (!trimmedCurrentText) {
    return trimmedTranscript;
  }

  return `${trimmedCurrentText} ${trimmedTranscript}`;
}

type VoiceControlMode = "hold" | "toggle";

const VOICE_MODE_STORAGE_KEY = STORAGE_KEYS.voiceControlMode;
const AUTO_VOICE_SILENCE_MS = 1700;
const AUTO_VOICE_NO_SPEECH_MS = 6500;

export default function InputBox({
  value,
  onChange,
  onClassify,
  onVoiceCaptureComplete,
  voiceIntent = false,
}: InputBoxProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const latestTextRef = useRef(value);
  const pointerStartedVoiceRef = useRef(false);
  const voiceIntentStartedRef = useRef(false);
  const voiceCaptureCompletedRef = useRef(false);
  const autoStopOnSilenceRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceControlMode, setVoiceControlMode] =
    useState<VoiceControlMode>("hold");

  useEffect(() => {
    setIsSpeechSupported(Boolean(getSpeechRecognitionConstructor()));

    const savedVoiceMode = window.localStorage.getItem(
      VOICE_MODE_STORAGE_KEY
    );

    if (savedVoiceMode === "hold" || savedVoiceMode === "toggle") {
      setVoiceControlMode(savedVoiceMode);
    }

    return () => {
      clearSilenceTimer();
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    latestTextRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!voiceIntent) {
      return;
    }

    setVoiceMessage("단축어로 열렸어요. 음성 기록을 바로 시작합니다.");
  }, [voiceIntent]);

  function updateVoiceControlMode(nextMode: VoiceControlMode) {
    setVoiceControlMode(nextMode);
    window.localStorage.setItem(VOICE_MODE_STORAGE_KEY, nextMode);
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current === null) return;

    window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }

  function scheduleSilenceStop(waitMs = AUTO_VOICE_SILENCE_MS) {
    if (!autoStopOnSilenceRef.current) return;

    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      const nextText = latestTextRef.current.trim();

      if (!nextText) {
        setVoiceMessage("음성이 감지되지 않았습니다. 다시 말해보세요.");
        stopVoiceInput();
        return;
      }

      setVoiceMessage("말이 끝난 것 같아 텍스트 초안으로 저장합니다.");
      stopVoiceInput();
    }, waitMs);
  }

  function stopVoiceInput() {
    clearSilenceTimer();
    autoStopOnSilenceRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript("");
  }

  function startVoiceInput({
    autoStopOnSilence = false,
  } = {}) {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      setVoiceMessage(
        "이 브라우저는 음성 인식을 지원하지 않습니다. iPhone Safari 또는 Chrome에서 다시 시도해보세요."
      );
      return;
    }

    if (isListening) {
      stopVoiceInput();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";

    baseTextRef.current = value;
    voiceCaptureCompletedRef.current = false;
    finalTranscriptRef.current = "";
    autoStopOnSilenceRef.current = autoStopOnSilence;
    setInterimTranscript("");
    setVoiceMessage(
      autoStopOnSilence
        ? "듣고 있어요. 말이 끝나면 자동으로 기록을 마칩니다."
        : "듣고 있어요. 떠오른 생각을 편하게 말해주세요."
    );

    recognition.onstart = () => {
      setIsListening(true);
      if (autoStopOnSilenceRef.current) {
        scheduleSilenceStop(AUTO_VOICE_NO_SPEECH_MS);
      }
    };

    recognition.onend = () => {
      clearSilenceTimer();
      autoStopOnSilenceRef.current = false;
      setIsListening(false);
      setInterimTranscript("");
      const completedText = latestTextRef.current.trim();
      if (completedText && !voiceCaptureCompletedRef.current) {
        voiceCaptureCompletedRef.current = true;
        onVoiceCaptureComplete?.(completedText);
      }
      setVoiceMessage((currentMessage) => {
        if (currentMessage?.includes("마이크 권한")) {
          return currentMessage;
        }

        return completedText
          ? "음성 내용을 승인 전 보관함에 저장하고 분류하고 있어요."
          : "음성 인식이 종료됐습니다.";
      });
    };

    recognition.onerror = (event) => {
      clearSilenceTimer();
      autoStopOnSilenceRef.current = false;
      setIsListening(false);
      setInterimTranscript("");

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceMessage(
          "마이크 권한이 필요합니다. iPhone 설정에서 나의 비서의 마이크와 음성 인식 권한을 허용해주세요."
        );
        return;
      }

      if (event.error === "no-speech") {
        setVoiceMessage("음성이 감지되지 않았습니다. 다시 말해보세요.");
        return;
      }

      setVoiceMessage("음성 인식 중 문제가 생겼습니다. 다시 시도해주세요.");
    };

    recognition.onspeechend = () => {
      scheduleSilenceStop(900);
    };

    recognition.onaudioend = () => {
      scheduleSilenceStop(900);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalTranscript) {
        finalTranscriptRef.current = appendTranscript(
          finalTranscriptRef.current,
          finalTranscript
        );
      }

      setInterimTranscript(interimText.trim());
      const nextText = appendTranscript(
        baseTextRef.current,
        `${finalTranscriptRef.current} ${interimText}`.trim()
      );

      latestTextRef.current = nextText;
      onChange(nextText);

      if (autoStopOnSilenceRef.current) {
        scheduleSilenceStop(
          nextText.trim() ? AUTO_VOICE_SILENCE_MS : AUTO_VOICE_NO_SPEECH_MS
        );
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setVoiceMessage("음성 인식을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  useEffect(() => {
    if (!voiceIntent || voiceIntentStartedRef.current || isListening) {
      return;
    }

    voiceIntentStartedRef.current = true;
    const timer = window.setTimeout(() => {
      startVoiceInput({
        autoStopOnSilence: true,
      });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [voiceIntent, isListening]);

  function handleVoiceButtonClick() {
    if (voiceControlMode === "hold") {
      return;
    }

    startVoiceInput({
      autoStopOnSilence: false,
    });
  }

  function handleVoicePointerDown() {
    if (voiceControlMode !== "hold" || isListening) {
      return;
    }

    pointerStartedVoiceRef.current = true;
    startVoiceInput({
      autoStopOnSilence: false,
    });
  }

  function handleVoicePointerEnd() {
    if (voiceControlMode !== "hold" || !pointerStartedVoiceRef.current) {
      return;
    }

    pointerStartedVoiceRef.current = false;
    stopVoiceInput();
  }

  return (
    <section className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="text-sm font-black text-slate-700">
            떠오른 생각을 입력해보세요
          </label>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            글로 쓰거나 마이크로 말하면 기록됩니다.
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
            isListening
              ? "bg-red-50 text-red-500"
              : isSpeechSupported
                ? "bg-blue-50 text-blue-600"
                : "bg-slate-100 text-slate-400"
          }`}
        >
          {isListening ? "듣는 중" : isSpeechSupported ? "음성 가능" : "음성 제한"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-xs font-black text-slate-500">
        <button
          type="button"
          onClick={() => updateVoiceControlMode("hold")}
          className={`rounded-xl px-3 py-2 transition ${
            voiceControlMode === "hold"
              ? "bg-white text-blue-600 shadow-sm"
              : "hover:text-slate-700"
          }`}
        >
          길게 눌러 말하기
        </button>
        <button
          type="button"
          onClick={() => updateVoiceControlMode("toggle")}
          className={`rounded-xl px-3 py-2 transition ${
            voiceControlMode === "toggle"
              ? "bg-white text-blue-600 shadow-sm"
              : "hover:text-slate-700"
          }`}
        >
          눌러 켜고 끄기
        </button>
      </div>

      <div className="mt-3 flex items-end gap-3 rounded-[22px] bg-slate-50 p-3 ring-1 ring-slate-100">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="예: 내일 3시 치과 예약"
          className="min-h-20 flex-1 resize-none bg-transparent px-1 py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
        />

        <button
          type="button"
          onClick={handleVoiceButtonClick}
          onPointerDown={handleVoicePointerDown}
          onPointerUp={handleVoicePointerEnd}
          onPointerCancel={handleVoicePointerEnd}
          onPointerLeave={handleVoicePointerEnd}
          aria-label={isListening ? "음성 입력 중지" : "음성 입력 시작"}
          className={`grid h-11 w-11 shrink-0 touch-none select-none place-items-center rounded-2xl text-white shadow-[0_12px_24px_rgba(49,130,246,0.22)] transition ${
            isListening
              ? "bg-red-500 hover:bg-red-400"
              : "bg-slate-900 hover:bg-slate-700"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
            <path d="M19 11a7 7 0 0 1-14 0" />
            <path d="M12 18v3" />
            <path d="M8 21h8" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onClassify()}
          aria-label="분류하기"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-[0_12px_24px_rgba(49,130,246,0.28)] transition hover:bg-blue-500"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v10" />
            <path d="M8 7h8" />
            <path d="M5 13a7 7 0 0 0 14 0" />
            <path d="M12 20v1" />
          </svg>
        </button>
      </div>

      {(voiceMessage || interimTranscript) && (
        <div
          className={`mt-3 rounded-2xl p-3 text-xs font-bold leading-5 ${
            isListening
              ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
              : "bg-slate-50 text-slate-500 ring-1 ring-slate-100"
          }`}
        >
          {voiceMessage && <p>{voiceMessage}</p>}
          {interimTranscript && (
            <p className="mt-1 text-blue-500">인식 중: {interimTranscript}</p>
          )}
          {voiceControlMode === "hold" && isListening && (
            <p className="mt-1 text-blue-500">손을 떼면 텍스트 초안으로 남깁니다.</p>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-black text-slate-500">
        {["할 일", "일정", "아이디어", "기타"].map((label) => (
          <span key={label} className="rounded-2xl bg-slate-100 px-2 py-2 text-center">
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
