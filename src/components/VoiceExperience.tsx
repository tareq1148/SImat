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

// نغمة قصيرة تقول «دورك الآن» — مولّدة بـWeb Audio، بلا ملف وبلا رصيد.
// الإنسان في المكالمة يعرف متى يتكلم من نبرة الصمت؛ هنا نعوّضها بإشارة.
function earcon(up: boolean) {
  try {
    const a = new AudioContext();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(up ? 620 : 880, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(up ? 880 : 620, a.currentTime + 0.09);
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, a.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.14);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.16);
    setTimeout(() => void a.close().catch(() => {}), 400);
  } catch {}
}

export default function VoiceExperience({
  messages,
  busy,
  confirmed,
  noSpeech,
  voice,
  cleanText,
  onClose,
}: {
  messages: Msg[];
  busy: boolean;
  confirmed: boolean;
  /** عدّاد يتزايد كلما لم يُلتقط كلام مفهوم */
  noSpeech: number;
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

  // خطأ عابر (شبكة، تفريغ فاشل) لا يجوز أن يوقف المحادثة للأبد — يُمسح تلقائيًا.
  // يُستثنى رفض المايك: ذاك يحتاج تدخل المستخدم فعلًا.
  const fatalError =
    voice.mode === "none" || /مايك|permission|not-allowed/i.test(voice.error ?? "");
  useEffect(() => {
    if (!voice.error || fatalError) return;
    const id = setTimeout(() => voice.clearError(), 2200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.error, fatalError]);

  // الحلقة: كلما هدأ كل شيء، عاود الاستماع
  useEffect(() => {
    if (paused || confirmed || pending || fatalError) return;
    if (busy || voice.speaking || voice.recording || voice.transcribing) return;
    const id = setTimeout(() => startRef.current(), 250);
    return () => clearTimeout(id);
  }, [
    paused,
    confirmed,
    pending,
    busy,
    fatalError,
    voice.speaking,
    voice.recording,
    voice.transcribing,
  ]);

  // اكتملت المواصفة → نعود لمساحة الإنشاء ليرى البطاقة
  useEffect(() => {
    if (!confirmed) return;
    voice.stopRecording();
    // لا تقطع آخر جملة: انتظر انتهاء النطق ثم أغلق
    if (voice.speaking) return;
    const id = setTimeout(onClose, 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, voice.speaking]);

  // «ما سمعتك» — تظهر لحظتين ثم تختفي، فلا يبقى المستخدم في صمت محيّر
  const [hint, setHint] = useState("");
  useEffect(() => {
    // الشرط على العدّاد نفسه لا على «أول تشغيل»: React يشغّل الأثر مرتين
    // عند التركيب في التطوير، فحارس المرة الأولى كان يُستهلك ثم تظهر الرسالة فورًا
    if (noSpeech === 0) return;
    setHint(t("voice.noSpeech"));
    const id = setTimeout(() => setHint(""), 2400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noSpeech]);

  // نغمة صاعدة لحظة فتح المايك
  const wasRecording = useRef(false);
  useEffect(() => {
    if (voice.recording && !wasRecording.current) earcon(true);
    wasRecording.current = voice.recording;
  }, [voice.recording]);

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
    // مقاطعة: إن كان يتكلم فأسكته وافتح المايك — كما تقاطع إنسانًا
    if (voice.speaking) {
      voice.stopSpeaking();
      setPending(false);
      setPaused(false);
      return;
    }
    if (voice.recording) {
      voice.stopRecording();
      setPaused(true);
      return;
    }
    setPaused(false);
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
  else if (hint) status = hint;
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
          <VoiceOrb size={220} big state={orbState} />
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

        </header>
        <div ref={listRef} className="conv-list">
          {messages.length === 0 && (
            <div className="conv-msg a">{t("voice.intro")}</div>
          )}
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
