"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AutomationSummaryCard from "@/components/AutomationSummaryCard";
import NeuralThinking from "@/components/NeuralThinking";
import OverviewStats from "@/components/OverviewStats";
import VoiceWave from "@/components/VoiceWave";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n";
import { useVoice } from "@/lib/useVoice";
import type { FlowStatus } from "@/lib/types";

const FLOW_DOTS: Partial<Record<FlowStatus, string>> = {
  Ready: "var(--ok)",
  Active: "var(--ok)",
  NeedsRepair: "var(--bad)",
  NotSuitable: "var(--bad)",
  NeedsInformation: "var(--warn)",
  NeedsConnections: "var(--warn)",
};

// مساراتك كشرائح أفقية داخل الرئيسية — بدل شاشة كاملة
function FlowsStrip() {
  const { t } = useLang();
  const [flows, setFlows] = useState<
    { id: string; name: string; status: FlowStatus }[] | null
  >(null);

  useEffect(() => {
    supabaseBrowser()
      .from("flows")
      .select("id, name, status")
      .order("updated_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setFlows((data as never) ?? []));
  }, []);

  if (!flows || flows.length === 0) return null;
  return (
    <div className="rise-2">
      <p className="text-[0.72rem] font-semibold text-[var(--text-soft)] mb-2">{t("home.flows")}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {flows.map((f) => (
          <Link
            key={f.id}
            href={`/flow/${f.id}`}
            className="shrink-0 flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[0.78rem] font-medium hover:border-[var(--accent-bg)] transition-colors"
          >
            <span
              className="status-dot"
              style={{ background: FLOW_DOTS[f.status] ?? "var(--edge)" }}
            />
            {f.name.length > 34 ? f.name.slice(0, 34) + "…" : f.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

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
  const { t } = useLang();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // التفريغ الصوتي يعبّئ خانة الكتابة فقط — الإرسال قرار المستخدم دائمًا
  const voice = useVoice((text) => {
    setInput((prev) => (prev.trim() ? prev.trimEnd() + " " : "") + text);
    textInputRef.current?.focus();
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

  return (
    <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4">
      {messages.length === 0 && (
        <div className="pt-14 pb-8 space-y-8">
          <div className="rise text-center">
            <h1 className="text-[2.1rem] md:text-[2.7rem] font-bold leading-snug mb-2.5 tracking-tight">
              {t("home.w1")}.{" "}
              {t("home.w2")}.{" "}
              <span className="text-[var(--accent)]">{t("home.w3")}.</span>
            </h1>
            <p className="text-[0.95rem] text-[var(--text-soft)]">{t("home.sub")}</p>
          </div>
          <div className="rise-1">
            <OverviewStats />
          </div>
          <FlowsStrip />
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-6 space-y-4">
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
        <div className="mb-3 text-sm text-red-300 bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {confirmed && !flowId && (
        <div className="mb-3 card px-5 py-3.5">
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

      {flowId && (
        <div className="mb-3">
          {building ? (
            <div className="card px-5 py-4">
              <NeuralThinking phase="building" />
            </div>
          ) : (
            <AutomationSummaryCard
              flowId={flowId}
              variant="full"
              onOpenFlow={() => router.push(`/flow/${flowId}`)}
              onBuild={buildFromChat}
            />
          )}
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
        <div className="mb-3 flex gap-2 flex-wrap">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => send(undefined, opt)}
              className="rounded-full border px-4 py-2 text-[0.83rem] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] transition-colors hover:border-[var(--accent-bg)]"
              style={{ borderColor: "color-mix(in srgb, var(--accent-bg) 35%, transparent)" }}
            >
              {opt}
            </button>
          ))}
          <button
            onClick={() => {
              setOptions([]);
              textInputRef.current?.focus();
            }}
            className="rounded-full border border-[var(--line)] text-[var(--text-soft)] px-4 py-2 text-[0.83rem] hover:text-[var(--text)] hover:bg-[var(--well)] transition-colors"
          >
            {t("opts.other")}
          </button>
        </div>
      )}

      {voice.speaking && !voice.recording && (
        <div className="mb-2 card px-4 py-2 flex items-center gap-3">
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

      <form onSubmit={send} className="pb-6 flex gap-2 items-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || uploading || attachments.length >= 3}
          title="أرفق ملفات (صور، PDF، بيانات) — حتى 3 ملفات"
          className={`tool-btn ${uploading ? "animate-pulse" : ""}`}
        >
          <ToolIcon kind="clip" />
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
            className={`tool-btn ${
              voice.recording
                ? "!border-[var(--bad)] !text-[var(--bad)] animate-pulse"
                : voice.transcribing
                  ? "animate-pulse"
                  : ""
            }`}
          >
            <ToolIcon kind={voice.recording ? "stop" : "mic"} />
          </button>
        )}
        {voice.mode !== "none" && (
          <button
            type="button"
            onClick={voice.toggleSpeak}
            title={voice.speakEnabled ? "أوقف نطق الردود" : "اسمع الردود صوتيًا"}
            className={`tool-btn ${
              voice.speakEnabled ? "!border-[var(--accent-bg)] !text-[var(--accent)]" : ""
            }`}
          >
            <ToolIcon kind="speaker" />
          </button>
        )}
        {voice.recording ? (
          <div className="input flex-1 flex items-center gap-3 !py-1.5">
            <span className="status-dot animate-pulse shrink-0" style={{ background: "var(--bad)" }} />
            <VoiceWave mode="mic" height={30} />
          </div>
        ) : (
          <input
            ref={textInputRef}
            className="input flex-1"
            placeholder={t("input.placeholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
        )}
        <button className="btn btn-primary" disabled={busy || !input.trim()}>
          {t("input.send")}
        </button>
      </form>
    </main>
  );
}
