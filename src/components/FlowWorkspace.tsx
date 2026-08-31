"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import FlowCanvas from "./FlowCanvas";
import EvaluationView from "./EvaluationView";
import StatusChip from "./StatusChip";
import AutomationSummaryCard from "./AutomationSummaryCard";
import { providerIcon } from "./icons";
import {
  PROVIDER_LABELS,
  type ConnectionRow,
  type Evaluation,
  type FlowRow,
  type IRNode,
  type Provider,
  type WorkflowIR,
} from "@/lib/types";

interface TestRunRow {
  id: string;
  passed: boolean | null;
  input: unknown;
  expected: unknown;
  actual: unknown;
  error: string | null;
  created_at: string;
}

interface RunRow {
  id: string;
  status: string;
  result: unknown;
  error: string | null;
  started_at: string;
}

interface ApprovalRow {
  id: string;
  action_type: string;
  summary: string | null;
  payload: unknown;
  status: string;
  created_at: string;
}

export default function FlowWorkspace({
  flow,
  ir,
  evaluation,
  initialConnections,
  initialTab,
}: {
  flow: FlowRow;
  ir: WorkflowIR | null;
  evaluation: Evaluation | null;
  initialConnections: ConnectionRow[];
  initialTab: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<string>(
    ["evaluation", "canvas", "run", "history"].includes(initialTab)
      ? initialTab
      : "evaluation"
  );
  const [connections, setConnections] = useState(initialConnections);
  const [selected, setSelected] = useState<IRNode | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [testRuns, setTestRuns] = useState<TestRunRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [modifyText, setModifyText] = useState("");
  const [versions, setVersions] = useState<
    { version: number; note: string | null; created_at: string }[]
  >([]);
  const [report, setReport] = useState<{
    runs_total: number;
    runs_success: number;
    success_rate: number | null;
    minutes_saved: number;
    manual_minutes_per_run: number | null;
  } | null>(null);
  const [minutesInput, setMinutesInput] = useState("");

  const connectedProviders = useMemo(
    () => connections.filter((c) => c.status === "connected").map((c) => c.provider),
    [connections]
  );

  const refreshData = useCallback(async () => {
    // مصالحة الحالات العالقة مع المحرك قبل القراءة (لا نوقف الاستطلاع لو فشلت)
    fetch(`/api/flows/${flow.id}/reconcile`, { method: "POST" }).catch(() => {});
    const sb = supabaseBrowser();
    const [tr, r, a] = await Promise.all([
      sb
        .from("test_runs")
        .select("id, passed, input, expected, actual, error, created_at")
        .eq("flow_id", flow.id)
        .order("created_at", { ascending: false })
        .limit(3),
      sb
        .from("runs")
        .select("id, status, result, error, started_at")
        .eq("flow_id", flow.id)
        .order("started_at", { ascending: false })
        .limit(5),
      sb
        .from("approvals")
        .select("id, action_type, summary, payload, status, created_at")
        .eq("flow_id", flow.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    if (tr.data) setTestRuns(tr.data as TestRunRow[]);
    if (r.data) setRuns(r.data as RunRow[]);
    if (a.data) setApprovals(a.data as ApprovalRow[]);
  }, [flow.id]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      refreshData();
    }, 3500);
    return () => clearInterval(interval);
  }, [refreshData]);

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "حدث خطأ");
    return data;
  }

  async function connect(provider: Provider, key?: string) {
    setBusy(`connect-${provider}`);
    setNotice(null);
    try {
      const body: Record<string, string> = { provider };
      if (provider === "openai" && key) body.openai_api_key = key;
      await post("/api/connections", body);
      const res = await fetch("/api/connections");
      const data = await res.json();
      setConnections(data.connections ?? []);
      setOpenaiKey("");
      setNotice({ kind: "ok", text: `تم ربط ${PROVIDER_LABELS[provider]} ✓` });
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  async function build() {
    setBusy("build");
    setNotice(null);
    try {
      const data = await post(`/api/flows/${flow.id}/build`);
      if (data.status === "NeedsConnections") {
        setNotice({
          kind: "err",
          text:
            "تحتاج ربط: " +
            (data.missing as Provider[]).map((p) => PROVIDER_LABELS[p]).join("، "),
        });
      } else {
        setNotice({ kind: "ok", text: "أُنشئ سير العمل في محرك التنفيذ — جاهز للاختبار ✓" });
        setTab("run");
      }
      router.refresh();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    setBusy("test");
    setNotice(null);
    try {
      await post(`/api/flows/${flow.id}/test`);
      setNotice({ kind: "ok", text: "بدأ الاختبار — النتيجة ستظهر خلال لحظات..." });
      router.refresh();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(action: "activate" | "pause") {
    setBusy(action);
    setNotice(null);
    try {
      await post(`/api/flows/${flow.id}/activate`, { action });
      setNotice({
        kind: "ok",
        text: action === "activate" ? "تم التفعيل — يمكنك التشغيل الآن ✓" : "تم الإيقاف مؤقتًا",
      });
      router.refresh();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  async function runNow() {
    setBusy("run");
    setNotice(null);
    try {
      await post(`/api/flows/${flow.id}/run`);
      setNotice({ kind: "ok", text: "بدأ التشغيل الفعلي — تابع الحالة أدناه." });
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  const loadHistory = useCallback(async () => {
    const [v, r] = await Promise.all([
      fetch(`/api/flows/${flow.id}/versions`).then((x) => x.json()),
      fetch(`/api/reports`).then((x) => x.json()),
    ]);
    setVersions(v.versions ?? []);
    const mine = (r.flows ?? []).find(
      (f: { flow_id: string }) => f.flow_id === flow.id
    );
    if (mine) {
      setReport(mine);
      setMinutesInput(String(mine.manual_minutes_per_run ?? ""));
    }
  }, [flow.id]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  async function modifyFlow() {
    if (!modifyText.trim()) return;
    setBusy("modify");
    setNotice(null);
    try {
      const data = await post(`/api/flows/${flow.id}/modify`, {
        instruction: modifyText.trim(),
      });
      setModifyText("");
      setNotice({ kind: "ok", text: `✏️ إصدار ${data.version}: ${data.summary} — نعيد البناء...` });
      router.refresh();
      await post(`/api/flows/${flow.id}/build`);
      setNotice({ kind: "ok", text: `✏️ ${data.summary} — أُعيد البناء، جرّب الاختبار الآن.` });
      router.refresh();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  async function repairFlow() {
    setBusy("repair");
    setNotice(null);
    try {
      const rep = await post(`/api/flows/${flow.id}/repair`);
      setNotice({
        kind: "ok",
        text: `🔧 ${rep.note} — نعيد البناء والاختبار تلقائيًا...`,
      });
      const b = await post(`/api/flows/${flow.id}/build`);
      if (b.status === "ReadyToTest") {
        await post(`/api/flows/${flow.id}/test`);
        setNotice({
          kind: "ok",
          text: `🔧 طُبّق الإصلاح (${rep.attempt}/2) وانطلق اختبار جديد — النتيجة خلال لحظات.`,
        });
      } else {
        setNotice({
          kind: "err",
          text: `الإصلاح طُبّق لكن البناء يحتاجك: ${b.detail ?? b.status}`,
        });
      }
      router.refresh();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  async function rollback(version: number) {
    setBusy(`rb-${version}`);
    setNotice(null);
    try {
      const data = await post(`/api/flows/${flow.id}/versions`, { version });
      setNotice({
        kind: "ok",
        text: `↩️ استُرجع الإصدار ${data.restoredFrom} كإصدار جديد ${data.newVersion} — أعد البناء والاختبار.`,
      });
      loadHistory();
      router.refresh();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  async function saveMinutes() {
    setBusy("minutes");
    try {
      await post(`/api/flows/${flow.id}/settings`, {
        manual_minutes_per_run: Number(minutesInput),
      });
      loadHistory();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  async function decide(approvalId: string, decision: "approved" | "rejected") {
    setBusy(`appr-${approvalId}`);
    setNotice(null);
    try {
      await post(`/api/approvals/${approvalId}`, { decision });
      setNotice({
        kind: "ok",
        text: decision === "approved" ? "تمت الموافقة — يتابع التنفيذ ✓" : "تم الرفض وأُوقف الإجراء.",
      });
      refreshData();
    } catch (err) {
      setNotice({ kind: "err", text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  const TABS = [
    ["evaluation", "⚖️ التقييم"],
    ["canvas", "🧩 الرسم والربط"],
    ["run", "▶️ الاختبار والتشغيل"],
    ["history", "🕘 الإصدارات والتقرير"],
  ] as const;

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-[var(--line-soft)] pb-3">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`btn text-sm ${tab === key ? "btn-primary" : "btn-ghost"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div
          className={`mb-4 text-sm rounded-xl px-4 py-3 border ${
            notice.kind === "ok"
              ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/30"
              : "text-red-300 bg-red-400/10 border-red-400/30"
          }`}
        >
          {notice.text}
        </div>
      )}

      {tab === "evaluation" &&
        (evaluation ? (
          <EvaluationView ev={evaluation} />
        ) : (
          <p className="text-slate-400">لا يوجد تقييم بعد.</p>
        ))}

      {tab === "canvas" && ir && (
        <div className="space-y-4">
          <AutomationSummaryCard
            flowId={flow.id}
            variant="connections"
            onConnectionsChanged={async () => {
              const res = await fetch("/api/connections");
              const data = await res.json();
              setConnections(data.connections ?? []);
            }}
          />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-400">
              هذا الرسم يطابق ما سيُنفَّذ فعليًا. اضغط أي عقدة لمراجعتها وربط حسابها.
            </p>
            <button className="btn btn-primary" onClick={build} disabled={busy === "build"}>
              {busy === "build"
                ? "نبني في المحرك..."
                : flow.n8n_workflow_id
                  ? "🔄 إعادة البناء والنشر"
                  : "🚀 إنشاء الحل في محرك التنفيذ"}
            </button>
          </div>

          <FlowCanvas
            ir={ir}
            connectedProviders={connectedProviders}
            onSelect={setSelected}
          />

          {selected && (
            <div className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--well)] border border-[var(--line)] flex items-center justify-center">
                    {providerIcon(selected.provider ?? selected.type, 22)}
                  </div>
                  <div>
                    <h3 className="font-bold">{selected.label}</h3>
                    <p className="text-xs text-slate-400">{selected.operation}</p>
                  </div>
                </div>
                <button className="text-slate-500 hover:text-white" onClick={() => setSelected(null)}>
                  ✕
                </button>
              </div>
              <p className="text-sm text-slate-300 mt-3 leading-relaxed">{selected.description}</p>
              {Object.keys(selected.params).length > 0 && (
                <div className="mt-3 text-xs text-slate-400 space-y-1">
                  {Object.entries(selected.params).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-slate-500">{k}:</span> {v}
                    </div>
                  ))}
                </div>
              )}
              {selected.provider && (
                <div className="mt-4 pt-4 border-t border-[var(--line-soft)]">
                  {connectedProviders.includes(selected.provider) ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-300">
                        ✓ {PROVIDER_LABELS[selected.provider]} متصل
                      </span>
                      <button
                        className="btn btn-danger text-xs py-1"
                        onClick={async () => {
                          await post("/api/connections", {
                            provider: selected.provider,
                            revoke: true,
                          });
                          const res = await fetch("/api/connections");
                          setConnections((await res.json()).connections ?? []);
                        }}
                      >
                        إلغاء الاتصال
                      </button>
                    </div>
                  ) : selected.provider === "openai" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        أدخل مفتاح OpenAI الخاص بك — يُحفظ مشفّرًا في خزنة محرك التنفيذ فقط ولن
                        يظهر مرة أخرى.
                      </p>
                      <div className="flex gap-2">
                        <input
                          className="input flex-1 text-xs"
                          dir="ltr"
                          type="password"
                          placeholder="sk-..."
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                        />
                        <button
                          className="btn btn-primary text-xs"
                          disabled={busy === "connect-openai"}
                          onClick={() => connect("openai", openaiKey || undefined)}
                        >
                          {openaiKey ? "حفظ وربط" : "استخدام مفتاح المنصة"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary text-xs"
                      disabled={busy === `connect-${selected.provider}`}
                      onClick={() => connect(selected.provider as Provider)}
                    >
                      ربط {PROVIDER_LABELS[selected.provider]} (OAuth)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-bold mb-2 text-sm">📝 طلب تعديل — بكلامك</h3>
            <p className="text-xs text-slate-400 mb-3">
              اطلب تعديلًا محددًا وسيُطبَّق كإصدار جديد مع الحفاظ على بقية المسار كما هو
              (مثال: «غيّر مستلم الإيميل إلى manager@co.com» أو «أضف خطوة تنبيه تيليجرام بعد التسجيل»).
            </p>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="اكتب التعديل المطلوب..."
                value={modifyText}
                onChange={(e) => setModifyText(e.target.value)}
                disabled={busy === "modify"}
              />
              <button
                className="btn btn-primary"
                onClick={modifyFlow}
                disabled={busy === "modify" || !modifyText.trim()}
              >
                {busy === "modify" ? "نطبّق التعديل..." : "نفّذ التعديل"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "run" && (
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <h3 className="font-bold">🧪 الاختبار قبل التفعيل</h3>
              <button
                className="btn btn-primary"
                onClick={runTest}
                disabled={busy === "test" || !flow.n8n_workflow_id}
              >
                {busy === "test" ? "نشغّل الاختبار..." : "شغّل الاختبار"}
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              يعمل على عينة الاختبار من المقابلة. الإجراءات الحساسة لا تُنفَّذ في الاختبار —
              تظهر كمعاينة فقط.
            </p>
            {!flow.n8n_workflow_id && (
              <p className="text-sm text-amber-300">ابنِ الحل أولًا من تبويب «الرسم والربط».</p>
            )}
            {testRuns.map((t) => (
              <div key={t.id} className="border border-[var(--line-soft)] rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  {t.passed === null ? (
                    <span className="chip border-cyan-400/40 text-cyan-300 bg-cyan-400/10">
                      ⏳ قيد التنفيذ...
                    </span>
                  ) : t.passed ? (
                    <span className="chip border-emerald-400/40 text-emerald-300 bg-emerald-400/10">
                      ✓ نجح الاختبار
                    </span>
                  ) : (
                    <span className="chip border-red-400/40 text-red-300 bg-red-400/10">
                      ✗ فشل
                    </span>
                  )}
                  <span className="text-[0.65rem] text-slate-500" dir="ltr">
                    {new Date(t.created_at).toLocaleString("ar")}
                  </span>
                </div>
                <div className="grid md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 mb-1">المدخل</div>
                    <pre className="bg-[var(--well)] rounded-lg p-2 overflow-auto max-h-32 text-slate-300" dir="ltr">
                      {JSON.stringify(t.input, null, 1)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">المتوقع</div>
                    <pre className="bg-[var(--well)] rounded-lg p-2 overflow-auto max-h-32 text-slate-300" dir="ltr">
                      {JSON.stringify(t.expected, null, 1)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">الفعلي</div>
                    <pre className="bg-[var(--well)] rounded-lg p-2 overflow-auto max-h-32 text-slate-300" dir="ltr">
                      {t.actual ? JSON.stringify(t.actual, null, 1) : "..."}
                    </pre>
                  </div>
                </div>
                {t.error && <p className="text-xs text-red-300 mt-2">{t.error}</p>}
                {t.passed === false && t === testRuns[0] && (
                  <button
                    className="btn btn-ghost text-xs mt-3 border-amber-400/40 text-amber-300"
                    onClick={repairFlow}
                    disabled={busy === "repair"}
                  >
                    {busy === "repair"
                      ? "🔧 نصلح ونعيد الاختبار..."
                      : "🔧 إصلاح تلقائي وإعادة الاختبار"}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="font-bold">⚡ التفعيل والتشغيل</h3>
              <div className="flex gap-2">
                {flow.status === "Active" ? (
                  <>
                    <button className="btn btn-ghost" onClick={() => toggleActive("pause")} disabled={busy === "pause"}>
                      ⏸ إيقاف مؤقت
                    </button>
                    <button className="btn btn-primary" onClick={runNow} disabled={busy === "run"}>
                      {busy === "run" ? "نبدأ..." : "▶️ تشغيل الآن"}
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => toggleActive("activate")}
                    disabled={busy === "activate" || (flow.status !== "Ready" && flow.status !== "Paused")}
                  >
                    تفعيل سير العمل
                  </button>
                )}
              </div>
            </div>
            {flow.status !== "Ready" && flow.status !== "Active" && flow.status !== "Paused" && (
              <p className="text-xs text-amber-300 mb-3">
                التفعيل يتاح بعد نجاح الاختبار (الحالة الحالية:{" "}
                <StatusChip status={flow.status} />)
              </p>
            )}

            {approvals.filter((a) => a.status === "pending").map((a) => (
              <div key={a.id} className="border border-amber-400/40 bg-amber-400/5 rounded-xl p-4 mb-3">
                <div className="font-bold text-amber-300 text-sm mb-1">
                  🛡️ موافقة مطلوبة: {a.action_type}
                </div>
                <p className="text-xs text-slate-300 mb-2 leading-relaxed">{a.summary}</p>
                {a.payload != null && (
                  <pre className="bg-[var(--well)] rounded-lg p-2 overflow-auto max-h-40 text-[0.68rem] text-slate-300 mb-3" dir="ltr">
                    {JSON.stringify(a.payload, null, 1)}
                  </pre>
                )}
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary text-xs"
                    disabled={busy === `appr-${a.id}`}
                    onClick={() => decide(a.id, "approved")}
                  >
                    ✓ أوافق على التنفيذ
                  </button>
                  <button
                    className="btn btn-danger text-xs"
                    disabled={busy === `appr-${a.id}`}
                    onClick={() => decide(a.id, "rejected")}
                  >
                    ✗ أرفض
                  </button>
                </div>
              </div>
            ))}

            {runs.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs text-slate-400 mb-2">آخر التشغيلات</h4>
                {runs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-[var(--line-soft)] py-2 text-sm">
                    <span className="text-[0.7rem] text-slate-500" dir="ltr">
                      {new Date(r.started_at).toLocaleString("ar")}
                    </span>
                    <span
                      className={`chip ${
                        r.status === "success"
                          ? "border-emerald-400/40 text-emerald-300 bg-emerald-400/10"
                          : r.status === "running" || r.status === "waiting_approval"
                            ? "border-cyan-400/40 text-cyan-300 bg-cyan-400/10"
                            : "border-red-400/40 text-red-300 bg-red-400/10"
                      }`}
                    >
                      {r.status === "success"
                        ? "نجح"
                        : r.status === "running"
                          ? "يعمل..."
                          : r.status === "waiting_approval"
                            ? "بانتظار موافقتك"
                            : r.status === "rejected"
                              ? "رفضته"
                              : "خطأ"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card p-5 text-center">
              <div className="text-3xl font-bold text-emerald-300">
                {report?.runs_success ?? 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">تشغيلة ناجحة</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-3xl font-bold text-cyan-300">
                {report?.success_rate != null ? `${report.success_rate}%` : "—"}
              </div>
              <div className="text-xs text-slate-400 mt-1">معدل النجاح</div>
            </div>
            <div className="card p-5 text-center">
              <div className="text-3xl font-bold text-violet-300">
                {report ? Math.round((report.minutes_saved / 60) * 10) / 10 : 0}
                <span className="text-base"> ساعة</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">وقت موفَّر تقريبي</div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-2 text-sm">⏱️ كم دقيقة كانت تأخذ منك يدويًا في كل مرة؟</h3>
            <p className="text-xs text-slate-400 mb-3">
              نستخدمها لحساب الوقت الموفَّر (الافتراضي 15 دقيقة).
            </p>
            <div className="flex gap-2 max-w-xs">
              <input
                className="input flex-1"
                type="number"
                dir="ltr"
                min={0}
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
              />
              <button
                className="btn btn-ghost"
                onClick={saveMinutes}
                disabled={busy === "minutes" || minutesInput === ""}
              >
                حفظ
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-4 text-sm">🕘 سجل الإصدارات</h3>
            {versions.length === 0 && (
              <p className="text-xs text-slate-500">لا توجد إصدارات بعد.</p>
            )}
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.version}
                  className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
                    v.version === flow.current_version
                      ? "border-cyan-400/40 bg-cyan-400/5"
                      : "border-[var(--line-soft)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      الإصدار {v.version}
                      {v.version === flow.current_version && (
                        <span className="chip mr-2 text-[0.6rem] px-2 py-0 border-cyan-400/40 text-cyan-300 bg-cyan-400/10">
                          الحالي
                        </span>
                      )}
                    </div>
                    <div className="text-[0.7rem] text-slate-400 leading-relaxed mt-0.5">
                      {v.note ?? "—"}
                    </div>
                    <div className="text-[0.62rem] text-slate-600 mt-0.5" dir="ltr">
                      {new Date(v.created_at).toLocaleString("ar")}
                    </div>
                  </div>
                  {v.version !== flow.current_version && (
                    <button
                      className="btn btn-ghost text-xs shrink-0"
                      onClick={() => rollback(v.version)}
                      disabled={busy === `rb-${v.version}`}
                    >
                      ↩️ استرجاع
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
