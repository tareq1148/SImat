"use client";

// شاشة المحادثة الصوتية — من تصميم المستخدم (01-live-nodes.html)
// حلقة مستمرة: وَتيرة يتحدث ← يستمع ← يحلل ← يتحدث… حتى تكتمل المواصفة

import { useEffect, useRef, useState } from "react";
import VoiceOrb from "./VoiceOrb";
import { useLang } from "@/lib/i18n";
import type { useVoice } from "@/lib/useVoice";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

export default function VoiceExperience({
  messages,
  busy,
  confirmed,
  voice,
  cleanText,
  onClose,
}: {
  messages: Msg[];
  busy: boolean;
  confirmed: boolean;
  voice: ReturnType<typeof useVoice>;
  cleanText: (t: string) => string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [paused, setPaused] = useState(false);
  // بانتظار أن يبدأ النطق فعليًا — حتى لا يفتح المايك فيسمع صوت وَتيرة نفسه
  const [pending, setPending] = useState(false);
  const prevBusy = useRef(busy);
  const listRef = useRef<HTMLDivElement>(null);
  const introRef = useRef(false);
  // مرجع حيّ حتى لا تُعيد الحلقة التشغيل عند تغيّر هوية الدالة
  const startRef = useRef(voice.startRecording);
  startRef.current = voice.startRecording;
  const speakRef = useRef(voice.speak);
  speakRef.current = voice.speak;

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && cleanText(m.text).trim());
  const question = lastAssistant ? cleanText(lastAssistant.text) : t("voice.intro");

  // وَتيرة ينطق أول سؤال فور فتح الشاشة
  useEffect(() => {
    if (introRef.current) return;
    introRef.current = true;
    setPending(true);
    speakRef.current(question, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // انتهى التحليل → رد جديد على وشك أن يُنطق
  useEffect(() => {
    if (prevBusy.current && !busy) setPending(true);
    prevBusy.current = busy;
  }, [busy]);

  // ننتظر بدء النطق، وإن لم يبدأ خلال ثانيتين نمضي
  useEffect(() => {
    if (!pending) return;
    if (voice.speaking) {
      setPending(false);
      return;
    }
    const id = setTimeout(() => setPending(false), 1100);
    return () => clearTimeout(id);
  }, [pending, voice.speaking]);

  // الحلقة: كلما هدأ كل شيء، عاود الاستماع
  useEffect(() => {
    if (paused || confirmed || pending || voice.error || voice.mode === "none") return;
    if (busy || voice.speaking || voice.recording || voice.transcribing) return;
    const id = setTimeout(() => startRef.current(), 250);
    return () => clearTimeout(id);
  }, [
    paused,
    confirmed,
    pending,
    busy,
    voice.error,
    voice.mode,
    voice.speaking,
    voice.recording,
    voice.transcribing,
  ]);

  // اكتملت المواصفة → نعود لمساحة الإنشاء ليرى البطاقة
  useEffect(() => {
    if (!confirmed) return;
    voice.stopRecording();
    const id = setTimeout(onClose, 2600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function close() {
    voice.stopRecording();
    voice.stopSpeaking();
    onClose();
  }

  function tapOrb() {
    if (voice.recording) {
      voice.stopRecording();
      setPaused(true);
    } else {
      setPaused(false);
    }
  }

  const orbState = voice.recording
    ? "listening"
    : voice.speaking || busy || voice.transcribing
      ? "speaking"
      : "idle";

  let status = "";
  let dots = false;
  if (confirmed) status = t("voice.complete");
  else if (voice.mode === "none") status = t("voice.unsupported");
  else if (voice.error) status = voice.error;
  else if (busy) {
    status = t("voice.processing");
    dots = true;
  } else if (voice.transcribing) {
    status = t("voice.transcribing");
    dots = true;
  } else if (voice.speaking) status = t("voice.talking");
  else if (voice.recording) {
    status = t("voice.listening");
    dots = true;
  } else if (paused) status = t("voice.paused");

  return (
    <div className="voice-exp">
      <button type="button" onClick={close} className="voice-back">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{t("voice.back")}</span>
      </button>

      <div className="voice-col">
        <button
          type="button"
          onClick={tapOrb}
          title={voice.recording ? t("input.stopVoice") : t("voice.resume")}
          className="rounded-full"
        >
          <VoiceOrb size={154} big state={orbState} />
        </button>

        <p className="voice-q">{question}</p>
        <small className="voice-hint">
          {paused && !confirmed ? t("voice.paused") : t("voice.continuous")}
        </small>

        {status && (
          <span className="voice-state">
            {dots && (
              <span className="wdots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
            {status}
          </span>
        )}
      </div>

      <aside className="conv-panel">
        <header className="conv-head">
          <span className="conv-title">{t("voice.title")}</span>
          <span className="conv-count">
            {messages.filter((m) => m.role === "user").length || ""}
          </span>
        </header>
        <div ref={listRef} className="conv-list">
          <div className="conv-msg a">{t("voice.intro")}</div>
          {messages.map(
            (m, i) =>
              (m.role === "user" || cleanText(m.text).trim()) && (
                <div key={i} className={`conv-msg ${m.role === "user" ? "u" : "a"}`}>
                  {m.role === "user" ? m.text : cleanText(m.text)}
                </div>
              )
          )}
        </div>
      </aside>
    </div>
  );
}
