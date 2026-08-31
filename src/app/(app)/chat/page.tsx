"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AutomationSummaryCard from "@/components/AutomationSummaryCard";
import { useVoice } from "@/lib/useVoice";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

// خيارات سريعة يقترحها سِمَاط بصيغة [[خيارات: أ | ب]] — تُعرض أزرارًا وتُخفى من النص
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

export default function ChatPage() {
  const router = useRouter();
  const [specId, setSpecId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "أهلًا بك في «سِمَاط» 👋\nصف لي المهمة التي تريد أتمتتها — ماذا تفعل فيها خطوة بخطوة؟ وسأسألك عن التفاصيل الناقصة.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    { id: string; name: string; size: number }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const voice = useVoice((text) => {
    send(undefined, text);
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

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
    setError(null);
    setBusy(true);
    const displayText =
      (text || "أرفقت ملفات 📎") +
      (sentAttachments.length
        ? "\n" + sentAttachments.map((f) => `📎 ${f.name}`).join("\n")
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
      if (assistantText.trim()) voice.speak(cleanText(assistantText));
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

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
    try {
      const res = await fetch(`/api/flows/${flowId}/build`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "تعذر البناء");
      router.push(`/flow/${flowId}?tab=run`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    }
  }

  return (
    <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4">
      <div className="flex items-center justify-between py-4 border-b border-[var(--line-soft)]">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">
          → لوحة المسارات
        </Link>
        <span className="text-sm font-semibold text-slate-300">مقابلة المهمة</span>
        {voice.mode !== "none" ? (
          <button
            onClick={voice.toggleSpeak}
            className={`chip cursor-pointer transition-colors ${
              voice.speakEnabled
                ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10"
                : "border-slate-500/40 text-slate-400 bg-slate-500/5"
            }`}
            title={
              voice.mode === "voicestudio"
                ? "الصوت عبر VoiceStudio المحلي"
                : "الصوت عبر المتصفح (شغّل VoiceStudio لجودة أعلى)"
            }
          >
            {voice.speakEnabled ? "🔊 الردود مسموعة" : "🔇 اسمع الردود"}
          </button>
        ) : (
          <span className="w-20" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-[0.93rem] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-gradient-to-l from-cyan-500/20 to-cyan-400/10 border border-cyan-400/20"
                  : "card"
              }`}
            >
              {cleanText(m.text) ||
                (busy && i === messages.length - 1 ? (
                  <span className="inline-flex gap-1">
                    <span className="typing-dot">●</span>
                    <span className="typing-dot">●</span>
                    <span className="typing-dot">●</span>
                  </span>
                ) : (
                  ""
                ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-300 bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {confirmed && !flowId && (
        <div className="mb-3 card border-emerald-400/40 px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm text-emerald-300">
            ✅ اكتملت المواصفة وتم تأكيدها — جاهزة للتقييم.
          </span>
          <button className="btn btn-primary" onClick={evaluate} disabled={evaluating}>
            {evaluating ? "نقيّم..." : "اعرض التقييم ←"}
          </button>
        </div>
      )}

      {flowId && (
        <div className="mb-3">
          <AutomationSummaryCard
            flowId={flowId}
            variant="full"
            onOpenFlow={() => router.push(`/flow/${flowId}`)}
            onBuild={buildFromChat}
          />
        </div>
      )}

      {voice.error && (
        <div className="mb-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2 flex justify-between items-center">
          <span>{voice.error}</span>
          <button onClick={voice.clearError} className="text-amber-400">✕</button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex gap-2 flex-wrap">
          {attachments.map((f) => (
            <span
              key={f.id}
              className="chip border-cyan-400/40 text-cyan-200 bg-cyan-400/10 gap-2"
            >
              📎 {f.name}
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
        <div className="mb-3 flex gap-2 flex-wrap">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => send(undefined, opt)}
              className="rounded-full border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 px-4 py-2 text-sm font-semibold hover:bg-cyan-400/20 hover:-translate-y-0.5 transition-all"
            >
              {opt}
            </button>
          ))}
          <button
            onClick={() => {
              setOptions([]);
              textInputRef.current?.focus();
            }}
            className="rounded-full border border-[var(--line)] bg-[var(--well)] text-slate-400 px-4 py-2 text-sm hover:text-slate-200 transition-colors"
          >
            ✏️ أخرى — أكتبها بنفسي
          </button>
        </div>
      )}

      <form onSubmit={send} className="pb-6 flex gap-2 items-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || uploading || attachments.length >= 3}
          title="أرفق ملفات (صور، PDF، بيانات) — حتى 3 ملفات"
          className={`shrink-0 w-11 h-11 rounded-full border flex items-center justify-center text-lg transition-all ${
            uploading
              ? "border-cyan-400/50 bg-cyan-400/10 animate-pulse"
              : "border-[var(--line)] bg-[var(--well)] hover:border-cyan-400/60"
          }`}
        >
          {uploading ? "…" : "📎"}
        </button>
        {voice.mode !== "none" && (
          <button
            type="button"
            onClick={voice.recording ? voice.stopRecording : voice.startRecording}
            disabled={busy || voice.transcribing}
            title={
              voice.recording
                ? "أوقف التسجيل"
                : voice.mode === "voicestudio"
                  ? "تكلّم — التفريغ محلي عبر VoiceStudio"
                  : "تكلّم — عبر مايك المتصفح"
            }
            className={`shrink-0 w-11 h-11 rounded-full border flex items-center justify-center text-lg transition-all ${
              voice.recording
                ? "border-red-400 bg-red-500/20 animate-pulse"
                : voice.transcribing
                  ? "border-cyan-400/50 bg-cyan-400/10"
                  : "border-[var(--line)] bg-[var(--well)] hover:border-cyan-400/60"
            }`}
          >
            {voice.recording ? "⏹" : voice.transcribing ? "…" : "🎙️"}
          </button>
        )}
        <input
          ref={textInputRef}
          className="input flex-1"
          placeholder={
            voice.recording ? "🎙️ نسمعك... تكلّم عن مهمتك" : "اكتب هنا... أو اضغط المايك وتكلّم"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="btn btn-primary" disabled={busy || !input.trim()}>
          إرسال
        </button>
      </form>
    </main>
  );
}
