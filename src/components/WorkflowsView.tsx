"use client";

// شاشة «سير العمل» — قائمة مساراتك + معاينة الرسم + تعديل بسيط لتعليمات الذكاء الاصطناعي

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { STATUS_LABELS, type FlowStatus, type IRNode, type Provider, type WorkflowIR } from "@/lib/types";
import FlowCanvas from "./FlowCanvas";
import StatusChip from "./StatusChip";

interface FlowLite {
  id: string;
  name: string;
  status: FlowStatus;
}

export default function WorkflowsView({ flows }: { flows: FlowLite[] }) {
  const { t } = useLang();
  const [activeId, setActiveId] = useState<string | null>(flows[0]?.id ?? null);
  const [ir, setIr] = useState<WorkflowIR | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState<IRNode | null>(null);
  const [promptText, setPromptText] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const active = flows.find((f) => f.id === activeId) ?? null;

  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) =>
        setProviders(((d.connections ?? []) as { provider: Provider }[]).map((c) => c.provider))
      )
      .catch(() => {});
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setSelected(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/flows/${id}/ir`);
      const d = await res.json();
      setIr(d.ir ?? null);
    } catch {
      setIr(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) load(activeId);
  }, [activeId, load]);

  async function savePrompt() {
    if (!selected || !activeId) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/flows/${activeId}/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: selected.id,
          params: { ...selected.params, prompt: promptText },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "خطأ");
      setNotice(t("wf.saved"));
      await load(activeId);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSaving(false);
    }
  }

  const editable = selected && /^step-\d+$/.test(selected.id);

  return (
    <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 sm:p-6 max-w-[1500px] mx-auto w-full">
      {/* قائمة المسارات */}
      <aside className="card p-5 w-full md:w-[300px] shrink-0 h-fit">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="font-bold text-[1.05rem]">{t("wf.yours")}</h2>
          <Link
            href="/chat"
            className="w-9 h-9 rounded-xl text-white text-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--grad-accent)" }}
            title={t("tab.create")}
          >
            +
          </Link>
        </div>
        <p className="text-xs text-[var(--text-soft)] mb-4">{t("wf.pick")}</p>

        {flows.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">{t("wf.empty")}</p>
        ) : (
          <div className="space-y-2">
            {flows.map((f, i) => {
              const on = f.id === activeId;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveId(f.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors ${
                    on
                      ? "border-[var(--accent-bg)] bg-[var(--accent-soft)]"
                      : "border-[var(--line-soft)] hover:bg-[var(--well)]"
                  }`}
                >
                  <span
                    className={`shrink-0 w-7 h-7 rounded-lg text-[0.78rem] font-bold flex items-center justify-center ${
                      on ? "text-white" : "text-[var(--text-soft)] bg-[var(--well)]"
                    }`}
                    style={on ? { background: "var(--grad-accent)" } : undefined}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 text-[0.85rem] font-semibold truncate">
                    {f.name}
                  </span>
                  <span className="text-[var(--text-soft)] text-xs shrink-0">›</span>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* المعاينة */}
      <section className="card flex-1 p-5 min-w-0">
        {active ? (
          <>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h1 className="text-[1.15rem] font-bold mb-0.5">{active.name}</h1>
                <p className="text-xs text-[var(--text-soft)]">{t("wf.preview")}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={active.status} />
                <Link href={`/flow/${active.id}`} className="btn btn-ghost text-xs py-1.5">
                  {t("wf.open")}
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="h-[440px] rounded-2xl bg-[var(--well)] animate-pulse" />
            ) : ir ? (
              <FlowCanvas ir={ir} connectedProviders={providers} onSelect={(n) => {
                setSelected(n);
                setPromptText(n.params.prompt ?? "");
                setNotice(null);
              }} />
            ) : (
              <p className="text-sm text-[var(--text-soft)] py-10 text-center">
                {STATUS_LABELS[active.status]}
              </p>
            )}

            {/* تعديل بسيط: نص التوجيه فقط */}
            {selected && (
              <div className="mt-4 card p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-sm">{selected.label}</h3>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-[var(--text-soft)] hover:text-[var(--text)]"
                  >
                    ✕
                  </button>
                </div>
                {editable ? (
                  <>
                    <p className="text-xs text-[var(--text-soft)] mb-2">{t("wf.promptHint")}</p>
                    <textarea
                      className="input text-[0.83rem] min-h-[92px] leading-relaxed"
                      placeholder={t("wf.promptEdit")}
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                    />
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={savePrompt}
                        disabled={saving}
                        className="btn btn-primary text-xs py-1.5"
                      >
                        {saving ? "…" : t("wf.save")}
                      </button>
                      {notice && (
                        <span className="text-xs text-[var(--accent)]">{notice}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--text-soft)]">{t("wf.noPrompt")}</p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--text-soft)] py-16 text-center">{t("wf.empty")}</p>
        )}
      </section>
    </main>
  );
}
