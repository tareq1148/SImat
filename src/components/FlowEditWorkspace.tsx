"use client";

// مساحة عمل المسار المحفوظ — نفس تقسيم شاشة الإنشاء: اللوحة يسارًا والمحادثة يمينًا.
// المحادثة هنا أداة تعديل: كل رسالة تعليمةُ تغيير تُنشئ إصدارًا جديدًا للمسار.

import { useEffect, useRef, useState } from "react";
import WorkspaceCanvas from "./WorkspaceCanvas";
import NeuralThinking from "./NeuralThinking";
import type { TranscriptMsg as Msg } from "@/lib/transcript";

export default function FlowEditWorkspace({
  flowId,
  flowName,
  history = [],
}: {
  flowId: string;
  flowName: string;
  /** محادثة المقابلة التي وُلد منها المسار */
  history?: Msg[];
}) {
  // المحادثة السابقة تُعرض كما جرت؛ وإن لم تُحفظ نكتفي بسطر تعريفي
  const [messages, setMessages] = useState<Msg[]>(
    history.length > 0
      ? history
      : [
          {
            role: "assistant",
            text: `هذا مسار «${flowName}». اكتب أي تعديل تبيه وأطبّقه على المسار مباشرة.`,
          },
        ]
  );
  const [hasHistory] = useState(history.length > 0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // كل تعديل ناجح يرفع المفتاح فتُعيد اللوحة قراءة الرسم
  const [reloadKey, setReloadKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // نفس رسوّ شاشة الإنشاء: الشريط يُطوى ويعلو المحادثة بدل أن يدفعها
  useEffect(() => {
    const tell = (docked: boolean) =>
      window.dispatchEvent(new CustomEvent("wt:workspace", { detail: { docked } }));
    tell(true);
    return () => {
      tell(false);
    };
  }, []);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const instruction = input.trim();
    if (!instruction || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: instruction }]);

    try {
      const res = await fetch(`/api/flows/${flowId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "تعذّر تطبيق التعديل");

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: [d.summary, d.diff && `التغيير: ${d.diff}`, `الإصدار ${d.version}.`]
            .filter(Boolean)
            .join("\n"),
        },
      ]);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ws-root is-split">
      <section className="ws-chat">
        <div className="flex-1 overflow-y-auto py-6 space-y-4 w-full">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-[0.88rem] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[var(--accent-soft)] border border-[var(--line)]"
                    : "card"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {hasHistory && messages.length === history.length && (
            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-[var(--line)]" />
              <span className="text-[0.68rem] text-[var(--text-soft)] shrink-0">
                اكتب أي تعديل هنا
              </span>
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>
          )}

          {busy && (
            <div className="flex justify-end">
              <div className="card rounded-2xl px-4 py-3">
                <NeuralThinking phase="thinking" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="mb-3 text-sm text-red-300 bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="ws-composer sticky bottom-0 pt-2 pb-5 bg-[var(--bg)]">
          <form onSubmit={send} className="composer">
            <input
              className="composer-input"
              placeholder="اكتب التعديل المطلوب…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button className="composer-send" disabled={busy || !input.trim()} title="أرسل">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
        </div>
      </section>

      <section className="ws-canvas" aria-label="لوحة سير العمل">
        <WorkspaceCanvas flowId={flowId} reloadKey={reloadKey} />
      </section>
    </main>
  );
}
