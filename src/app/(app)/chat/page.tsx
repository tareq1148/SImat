"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AutomationSummaryCard from "@/components/AutomationSummaryCard";
import NeuralField from "@/components/NeuralField";
import NeuralThinking from "@/components/NeuralThinking";
import VoiceExperience from "@/components/VoiceExperience";
import VoiceOrb from "@/components/VoiceOrb";
import VoiceWave from "@/components/VoiceWave";
import WorkspaceCanvas from "@/components/WorkspaceCanvas";
import { useLang } from "@/lib/i18n";
import { useVoice } from "@/lib/useVoice";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

// خيارات سريعة يقترحها وَتيرة بصيغة [[خيارات: أ | ب]] — تُعرض أزرارًا وتُخفى من النص
const OPTIONS_RE = /\[\[خيارات:([^\]]*)\]\]/;

function extractOptions(text: string): string[] {
  const m = text.match(OPTIONS_RE);
  if (!m) return [];
  return m[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanText(text: string): string {
  // يزيل الصيغة كاملة أو ناقصة أثناء البث حتى لا تومض للمستخدم
  return text.replace(OPTIONS_RE, "").replace(/\[\[خيارات:[^\]]*$/, "").trimEnd();
}

function ToolIcon({ kind }: { kind: "clip" | "mic" | "stop" | "speaker" | "send" }) {
  const paths = {
    clip: <path d="M20 11.5 12.6 19a5 5 0 0 1-7.1-7.1l7.8-7.8a3.4 3.4 0 0 1 4.8 4.8l-7.8 7.8a1.8 1.8 0 0 1-2.5-2.5l7-7" />,
    mic: <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15zM6 11.5a6 6 0 0 0 12 0M12 17.5V21" />,
    stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
    speaker: <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4zM15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />,
    send: <path d="M4 12h13M12 5l7 7-7 7" />,
  };
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[kind]}
    </svg>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const { lang, t } = useLang();
  const [specId, setSpecId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [building, setBuilding] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    { id: string; name: string; size: number }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // شاشة المحادثة الصوتية — تُفتح من كرة الصوت
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  voiceModeRef.current = voiceMode;
  const sendRef = useRef<(e?: React.FormEvent, override?: string) => void>(() => {});
  // داخل الشاشة الصوتية يُرسَل الكلام مباشرة؛ خارجها يعبّئ خانة الكتابة فقط
  const voice = useVoice((text) => {
    if (voiceModeRef.current) {
      sendRef.current(undefined, text);
      return;
    }
    setInput((prev) => (prev.trim() ? prev.trimEnd() + " " : "") + text);
    textInputRef.current?.focus();
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // فكرة جاهزة قادمة من شاشة الإنجازات (?q=) تُعبّأ في الحقل — والإرسال قرار المستخدم
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setInput(q);
      textInputRef.current?.focus();
    }
  }, []);

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list).slice(0, 3 - attachments.length)) {
        const form = new FormData();
        form.append("file", file);
        if (specId) form.append("specId", specId);
        const res = await fetch("/api/files/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "تعذر رفع الملف");
        setAttachments((a) => [...a, data.file]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الرفع");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function send(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if ((!text && attachments.length === 0) || busy) return;
    const sentAttachments = attachments;
    setAttachments([]);
    setInput("");
    setOptions([]);
    setOtherOpen(false);
    setOtherText("");
    setError(null);
    setBusy(true);
    const displayText =
      (text || "أرفقت ملفات") +
      (sentAttachments.length
        ? "\n" + sentAttachments.map((f) => `مرفق: ${f.name}`).join("\n")
        : "");
    setMessages((m) => [
      ...m,
      { role: "user", text: displayText },
      { role: "assistant", text: "" },
    ]);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specId,
          message: text,
          attachments: sentAttachments.map((f) => f.id),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "خطأ في الاتصال" }));
        throw new Error(data.error ?? "خطأ في الاتصال");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const evt = JSON.parse(part.slice(6));
          if (evt.type === "spec_id") setSpecId(evt.specId);
          else if (evt.type === "delta") {
            assistantText += evt.text;
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                role: "assistant",
                text: copy[copy.length - 1].text + evt.text,
              };
              return copy;
            });
          } else if (evt.type === "spec_saved" && evt.confirmed) {
            setConfirmed(true);
          } else if (evt.type === "error") {
            setError(evt.error);
          }
        }
      }
      setOptions(extractOptions(assistantText));
      // في الوضع الصوتي ينطق دائمًا، وإلا يحترم مفتاح «اسمع الردود»
      if (assistantText.trim()) voice.speak(cleanText(assistantText), voiceModeRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  sendRef.current = send;

  async function evaluate() {
    if (!specId) return;
    setEvaluating(true);
    setError(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذر التقييم");
      setFlowId(data.flowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setEvaluating(false);
    }
  }

  async function buildFromChat() {
    if (!flowId) return;
    setBuilding(true);
    try {
      const res = await fetch(`/api/flows/${flowId}/build`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "تعذر البناء");
      router.push(`/flow/${flowId}?tab=run`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
      setBuilding(false);
    }
  }

  // انتقال مساحة العمل: بمجرد ولادة المسار ترسو المحادثة جانبًا وتتمدّد اللوحة
  const split = !!flowId;

  // إشعار الشريط الجانبي — يطوي نفسه ويصير طبقة تعلو المحادثة بدل أن تدفعها
  useEffect(() => {
    const tell = (docked: boolean) =>
      window.dispatchEvent(new CustomEvent("wt:workspace", { detail: { docked } }));
    tell(split);
    return () => {
      tell(false);
    };
  }, [split]);

  return (
    <main className={`ws-root ${split ? "is-split" : ""}`}>
      <section className="ws-chat">
      {messages.length === 0 && !split && (
        <div className="flex-1 flex flex-col items-center justify-start pt-16 sm:pt-24 pb-4">
          <div className="rise text-center">
            <h1 className="text-[2.1rem] md:text-[2.9rem] font-bold leading-snug mb-3 tracking-tight">
              {t("home.w1")}.{" "}
              {t("home.w2")}.{" "}
              <span className="text-[var(--accent)]">{t("home.w3")}.</span>
            </h1>
            <p className="text-[0.95rem] text-[var(--text-soft)]">{t("home.sub")}</p>
          </div>

          {/* كوكبة الشبكة — تحت العنوان مباشرة، بهالة قطرية ناعمة خلفها */}
          <div className="rise-1 relative w-full max-w-5xl mt-6 sm:mt-8" aria-hidden>
            <div className="hero-glow pointer-events-none absolute inset-0" />
            <div className="neural-mask relative">
              <NeuralField height={420} />
            </div>
          </div>
        </div>
      )}

      <div
        className={
          messages.length === 0
            ? "hidden"
            : "flex-1 overflow-y-auto py-6 space-y-4 w-full max-w-3xl mx-auto"
        }
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-[0.9rem] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[var(--accent-soft)] border border-[var(--line)]"
                  : "card"
              }`}
            >
              {cleanText(m.text) ||
                (busy && i === messages.length - 1 ? (
                  <NeuralThinking phase="thinking" />
                ) : (
                  ""
                ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="w-full max-w-3xl mx-auto mb-3 text-sm text-red-300 bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {confirmed && !flowId && (
        <div className="w-full max-w-3xl mx-auto mb-3 card px-5 py-3.5">
          {evaluating ? (
            <NeuralThinking phase="evaluating" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-emerald-300">{t("spec.ready")}</span>
              <button className="btn btn-primary" onClick={evaluate}>
                {t("spec.showEval")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* اللوحة تتكفّل بالاسم والحالة وزر التشغيل — فيبقى هنا ما يحتاج تدخّل المستخدم */}
      {flowId && !building && (
        <div className="w-full max-w-3xl mx-auto mb-3">
          <AutomationSummaryCard
            flowId={flowId}
            variant="connections"
            onOpenFlow={() => router.push(`/flow/${flowId}`)}
            onBuild={buildFromChat}
          />
        </div>
      )}

      {voice.error && (
        <div className="w-full max-w-3xl mx-auto mb-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 flex justify-between items-center">
          <span>{voice.error}</span>
          <button onClick={voice.clearError} className="text-amber-400">✕</button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="w-full max-w-3xl mx-auto mb-2 flex gap-2 flex-wrap">
          {attachments.map((f) => (
            <span
              key={f.id}
              className="chip border-cyan-400/40 text-cyan-200 bg-cyan-400/10 gap-2"
            >
              {f.name}
              <span className="text-slate-500 text-[0.6rem]" dir="ltr">
                {Math.round(f.size / 1024)}KB
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-red-300"
                onClick={() =>
                  setAttachments((a) => a.filter((x) => x.id !== f.id))
                }
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,text/markdown,application/json,.xlsx,.docx"
        onChange={(e) => uploadFiles(e.target.files)}
      />

      {options.length > 0 && !busy && (
        <div className="w-full max-w-3xl mx-auto mb-3 space-y-2 rise">
          <div className="grid sm:grid-cols-2 gap-2">
            {options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => send(undefined, opt)}
                className="opt-btn group flex items-center gap-2.5 text-start rounded-xl border px-3.5 py-2.5 text-[0.83rem] font-semibold"
              >
                <span className="opt-num shrink-0 w-5 h-5 rounded-md text-[0.62rem] font-bold text-white flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="leading-snug">{opt}</span>
              </button>
            ))}
          </div>

          {otherOpen ? (
            <div className="flex gap-2 items-center rounded-xl border border-[var(--accent-bg)] bg-[var(--surface)] p-1.5 rise">
              <input
                autoFocus
                className="flex-1 bg-transparent border-0 outline-none px-2.5 text-[0.83rem] text-[var(--text)] placeholder:text-[var(--text-soft)]"
                placeholder={t("opts.otherPlaceholder")}
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && otherText.trim()) {
                    e.preventDefault();
                    send(undefined, otherText.trim());
                  }
                  if (e.key === "Escape") setOtherOpen(false);
                }}
              />
              <button
                onClick={() => otherText.trim() && send(undefined, otherText.trim())}
                disabled={!otherText.trim()}
                className="btn btn-primary text-[0.75rem] py-1.5 px-4 shrink-0"
              >
                {t("input.send")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOtherOpen(true)}
              className="opt-other w-full rounded-xl border border-dashed border-[var(--line)] text-[var(--text-soft)] px-3.5 py-2.5 text-[0.8rem]"
            >
              {t("opts.other")}
            </button>
          )}
        </div>
      )}

      {voice.speaking && !voice.recording && (
        <div className="w-full max-w-3xl mx-auto mb-2 card px-4 py-2 flex items-center gap-3">
          <span className="text-[0.72rem] text-[var(--text-soft)] shrink-0">{t("voice.speaking")}</span>
          <VoiceWave mode="ambient" height={20} />
          <button
            onClick={voice.stopSpeaking}
            title="إيقاف"
            className="text-[var(--text-soft)] hover:text-[var(--text)] shrink-0"
          >
            <ToolIcon kind="stop" />
          </button>
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto sticky bottom-0 pt-2 pb-5 bg-[var(--bg)] flex items-center gap-3">
        <form onSubmit={send} className="composer flex-1 min-w-0">
          {/* + المرفقات */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || uploading || attachments.length >= 3}
            title={t("input.attach")}
            className={`composer-plus ${uploading ? "animate-pulse" : ""}`}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          {/* حقل الكتابة — أو موجة الصوت أثناء التسجيل */}
          {voice.recording ? (
            <div className="flex-1 flex items-center gap-3 min-w-0 px-1">
              <span className="status-dot animate-pulse shrink-0" style={{ background: "var(--bad)" }} />
              <VoiceWave mode="mic" height={28} />
            </div>
          ) : (
            <input
              ref={textInputRef}
              className="composer-input"
              placeholder={t("input.placeholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
          )}

          {/* إرسال — في طرف الحبّة الأيسر */}
          <button
            className="composer-send"
            disabled={busy || (!input.trim() && attachments.length === 0)}
            title={t("input.send")}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>

        {/* كرة الصوت — خارج الصندوق على يساره، تفتح شاشة المحادثة الصوتية */}
        {voice.mode !== "none" && (
          <button
            type="button"
            onClick={() => setVoiceMode(true)}
            disabled={busy}
            title={t("input.talk")}
            className="shrink-0 leading-none disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <VoiceOrb
              size={48}
              state={voice.speaking || voice.transcribing ? "speaking" : "idle"}
            />
          </button>
        )}
      </div>
      </section>

      {split && (
        <section className="ws-canvas" aria-label="لوحة سير العمل">
          <WorkspaceCanvas
            flowId={flowId}
            building={building}
            onDeploy={buildFromChat}
            onOpenFull={() => router.push(`/flow/${flowId}`)}
          />
        </section>
      )}

      {voiceMode && (
        <VoiceExperience
          messages={messages}
          busy={busy}
          confirmed={confirmed}
          voice={voice}
          cleanText={cleanText}
          onClose={() => setVoiceMode(false)}
        />
      )}
    </main>
  );
}
