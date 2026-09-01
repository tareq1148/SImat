"use client";

// صفحة فحص التكاملات: نبضة لكل خدمة عبر Webhook في المحرك، والنتائج
// تُغذّي لوحة الرسم مباشرةً فيتحرك فرع الخدمة أثناء تنفيذها.

import { useCallback, useState } from "react";
import ExecutionGraph, { type RunState } from "@/components/ExecutionGraph";

const SERVICES = [
  { id: "drive", label: "Drive", action: "drive:list" },
  { id: "sheets", label: "Sheets", action: "sheets:read" },
  { id: "slides", label: "Slides", action: "slides:create" },
  { id: "calendar", label: "Calendar", action: "calendar:list" },
  { id: "docs", label: "Docs", action: "docs:create" },
] as const;

interface PingResult {
  ok: boolean;
  status: number;
  service: string;
  action: string;
  error?: string;
  ms: number;
}

const BADGE: Record<RunState, string> = {
  idle: "chip chip-neutral",
  running: "chip border-[var(--accent-bg)] text-[var(--accent)] bg-[var(--accent-soft)]",
  success: "chip border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
  error: "chip border-red-400/40 text-red-300 bg-red-400/10",
};

const LABEL: Record<RunState, string> = {
  idle: "لم يُفحص",
  running: "جارٍ…",
  success: "يعمل",
  error: "فشل",
};

export default function TestIntegrationsPage() {
  const [states, setStates] = useState<Record<string, RunState>>({});
  const [results, setResults] = useState<Record<string, PingResult>>({});
  const [busy, setBusy] = useState(false);

  const ping = useCallback(async (service?: string) => {
    const targets = service ? [service] : SERVICES.map((s) => s.id);
    setBusy(true);
    // «جارٍ» يُضيء فرع الخدمة في اللوحة أثناء الانتظار
    setStates((p) => ({
      ...p,
      ...Object.fromEntries(targets.map((t) => [t, "running" as RunState])),
    }));

    try {
      const res = await fetch("/api/integrations/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(service ? { service } : {}),
      });
      const data = (await res.json()) as { results?: PingResult[]; error?: string };

      if (!res.ok || !data.results) {
        setStates((p) => ({
          ...p,
          ...Object.fromEntries(targets.map((t) => [t, "error" as RunState])),
        }));
        setResults((p) => ({
          ...p,
          ...Object.fromEntries(
            targets.map((t) => [
              t,
              { ok: false, status: res.status, service: t, action: "-", error: data.error ?? "فشل الطلب", ms: 0 },
            ])
          ),
        }));
        return;
      }

      setStates((p) => ({
        ...p,
        ...Object.fromEntries(data.results!.map((r) => [r.service, r.ok ? "success" : "error"])),
      }));
      setResults((p) => ({
        ...p,
        ...Object.fromEntries(data.results!.map((r) => [r.service, r])),
      }));
    } catch (err) {
      setStates((p) => ({
        ...p,
        ...Object.fromEntries(targets.map((t) => [t, "error" as RunState])),
      }));
      setResults((p) => ({
        ...p,
        ...Object.fromEntries(
          targets.map((t) => [
            t,
            {
              ok: false, status: 0, service: t, action: "-",
              error: err instanceof Error ? err.message : "خطأ", ms: 0,
            },
          ])
        ),
      }));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">فحص التكاملات</h1>
          <p className="text-[0.85rem] text-[var(--text-soft)]">
            نبضة اختبار لكل خدمة عبر Webhook في المحرك — النتيجة تُضيء فرعها في الرسم.
          </p>
        </div>
        <button onClick={() => ping()} disabled={busy} className="btn btn-primary">
          {busy ? "جارٍ الفحص…" : "افحص الخمس"}
        </button>
      </div>

      <ExecutionGraph height={460} serviceStates={states} />

      <div className="mt-6 space-y-2">
        {SERVICES.map((s) => {
          const st = states[s.id] ?? "idle";
          const r = results[s.id];
          return (
            <div
              key={s.id}
              className="card px-4 py-3 flex items-center gap-3 flex-wrap"
            >
              <span className="font-semibold text-[0.88rem] min-w-[86px]">{s.label}</span>
              <code dir="ltr" className="text-[0.7rem] text-[var(--text-soft)]">
                {s.action}
              </code>
              <span className={BADGE[st]}>{LABEL[st]}</span>
              {r && (
                <span className="text-[0.7rem] text-[var(--text-soft)]" dir="ltr">
                  {r.status || "—"} · {r.ms}ms
                </span>
              )}
              {r?.error && (
                <span className="text-[0.72rem] text-amber-300 flex-1 min-w-[200px] leading-snug">
                  {r.error}
                </span>
              )}
              <button
                onClick={() => ping(s.id)}
                disabled={busy}
                className="btn btn-ghost text-[0.72rem] py-1.5 ms-auto"
              >
                افحص
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
