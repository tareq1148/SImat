"use client";

// بطاقة الأتمتة المختصرة — تعرض استجابة /summary الجاهزة للواجهة:
// رسالة قصيرة + بطاقات ربط ديناميكية (+ Connect) + جدول خطوات مضغوط + حالة المحرك

import { useCallback, useEffect, useState } from "react";
import type { UiSummary } from "@/lib/summary";
import type { Provider } from "@/lib/types";
import { providerIcon } from "./icons";

const TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  deterministic: { label: "ثابت", cls: "border-slate-400/40 text-slate-300 bg-slate-400/10" },
  ai_assisted: { label: "ذكاء اصطناعي", cls: "border-violet-400/40 text-violet-300 bg-violet-400/10" },
  agentic: { label: "وكيلي", cls: "border-fuchsia-400/40 text-fuchsia-300 bg-fuchsia-400/10" },
  browser_automation: { label: "متصفح", cls: "border-orange-400/40 text-orange-300 bg-orange-400/10" },
  human_in_loop: { label: "موافقة بشرية", cls: "border-amber-400/40 text-amber-300 bg-amber-400/10" },
  not_suitable: { label: "غير مناسب", cls: "border-red-400/40 text-red-300 bg-red-400/10" },
};

const ENGINE_LABELS: Record<UiSummary["n8n_integration"]["status"], string> = {
  AWAITING_CONNECTIONS: "بانتظار ربط الحسابات",
  READY_FOR_DEPLOYMENT: "جاهز للإنشاء في المحرك",
  DEPLOYED: "مبني في المحرك",
  DEPLOYED_ACTIVE: "مبني ومفعّل",
  NOT_APPLICABLE: "—",
};

export default function AutomationSummaryCard({
  flowId,
  variant = "full",
  onOpenFlow,
  onBuild,
  onConnectionsChanged,
}: {
  flowId: string;
  variant?: "full" | "connections";
  onOpenFlow?: () => void;
  onBuild?: () => void;
  onConnectionsChanged?: () => void;
}) {
  const [data, setData] = useState<UiSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/flows/${flowId}/summary`);
    if (res.ok) setData(await res.json());
  }, [flowId]);

  useEffect(() => {
    load();
  }, [load]);

  async function connect(provider: Provider) {
    setBusy(provider);
    setErr(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "تعذر الربط");
      await load();
      onConnectionsChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="card p-5 text-sm text-slate-400 animate-pulse">
        نجهّز بطاقة الأتمتة...
      </div>
    );
  }

  const allConnected = data.required_integrations.every(
    (i) => i.status === "CONNECTED"
  );

  return (
    <div className="card p-5 space-y-4 border-cyan-400/30">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-cyan-200 mb-1">{data.ui_message}</p>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-slate-200">{data.summary.process_name}</span>
            <span className="chip border-emerald-400/40 text-emerald-300 bg-emerald-400/10">
              الجدوى {data.summary.feasibility_score}/100
            </span>
            <span className="chip border-violet-400/40 text-violet-300 bg-violet-400/10" dir="ltr">
              {data.summary.architecture_pattern}
            </span>
          </div>
        </div>
        {onOpenFlow && (
          <button className="btn btn-ghost text-xs" onClick={onOpenFlow}>
            فتح المسار كاملًا ←
          </button>
        )}
      </div>

      {data.required_integrations.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.required_integrations.map((integ) => (
            <div
              key={integ.id}
              className={`rounded-xl border p-3 flex flex-col items-center gap-2 text-center transition-colors ${
                integ.status === "CONNECTED"
                  ? "border-emerald-400/40 bg-emerald-400/5"
                  : "border-[var(--line)] bg-[var(--well)]"
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--well)] border border-[var(--line)] flex items-center justify-center">
                {providerIcon(integ.id, 20)}
              </div>
              <div className="text-xs font-semibold">{integ.display_name}</div>
              {integ.status === "CONNECTED" ? (
                <span className="chip text-[0.62rem] px-2 py-0 border-emerald-400/40 text-emerald-300 bg-emerald-400/10">
                  ✓ متصل
                </span>
              ) : (
                <button
                  className="btn btn-primary text-[0.68rem] px-2.5 py-1 w-full justify-center"
                  disabled={busy === integ.id}
                  onClick={() => connect(integ.id)}
                >
                  {busy === integ.id ? "..." : integ.action_label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {err && <p className="text-xs text-red-300">{err}</p>}

      {variant === "full" && data.steps_breakdown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-[var(--line-soft)]">
                <th className="text-right py-1.5 pl-2 font-medium">#</th>
                <th className="text-right py-1.5 pl-2 font-medium">الخطوة</th>
                <th className="text-right py-1.5 pl-2 font-medium">النوع</th>
                <th className="text-right py-1.5 pl-2 font-medium">الأداة</th>
                <th className="text-right py-1.5 font-medium">موافقة</th>
              </tr>
            </thead>
            <tbody>
              {data.steps_breakdown.map((s) => {
                const badge = TYPE_BADGES[s.execution_type] ?? TYPE_BADGES.deterministic;
                return (
                  <tr key={s.step_number} className="border-b border-[var(--well)]">
                    <td className="py-1.5 pl-2 text-slate-500">{s.step_number}</td>
                    <td className="py-1.5 pl-2 text-slate-200">{s.action}</td>
                    <td className="py-1.5 pl-2">
                      <span className={`chip text-[0.6rem] px-2 py-0 ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-1.5 pl-2 text-slate-400" dir="ltr">
                      {s.tool}
                    </td>
                    <td className="py-1.5">{s.requires_human_approval ? "🛡️" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-[var(--line-soft)]">
        <div className="text-[0.7rem] text-slate-400">
          محرك التنفيذ:{" "}
          <span className="text-slate-200 font-semibold">
            {ENGINE_LABELS[data.n8n_integration.status]}
          </span>
        </div>
        {onBuild &&
          allConnected &&
          data.n8n_integration.status === "READY_FOR_DEPLOYMENT" && (
            <button className="btn btn-primary text-xs" onClick={onBuild}>
              إنشاء الحل في محرك التنفيذ
            </button>
          )}
      </div>
    </div>
  );
}
