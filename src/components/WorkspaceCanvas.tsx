"use client";

// لوحة المسار (75%) — تظهر بجوار المحادثة المرساة.
// عرض للقراءة فقط: تصفّح وتفتيش بلا سحب عقد ولا تحرير.
// في شريطها زرّان: اختبار، ومفتاحُ تشغيلٍ وإيقاف يتبدّل في موضعه.

import { useCallback, useEffect, useState } from "react";
import ExecutionGraph from "./ExecutionGraph";
import NeuralThinking from "./NeuralThinking";
import NodeInspector from "./NodeInspector";
import { PROVIDER_LABELS, type FlowStatus, type Provider, type WorkflowIR } from "@/lib/types";

interface LastTest {
  passed: boolean | null;
  error: string | null;
}

interface FlowInfo {
  name: string;
  status: FlowStatus;
  ir: WorkflowIR | null;
  lastTest: LastTest | null;
}

/** حالات لم يُبنَ فيها المسار بعد — «اختبار» يبنيه أولًا بدل أن يقف معطّلًا */
const UNBUILT: FlowStatus[] = ["Draft", "NeedsInformation", "NeedsConnections"];

export default function WorkspaceCanvas({
  flowId,
  building = false,
  reloadKey = 0,
}: {
  flowId: string;
  building?: boolean;
  /** تغييره يعيد قراءة الرسم — بعد تعديلٍ يُنشئ إصدارًا جديدًا */
  reloadKey?: number;
}) {
  const [info, setInfo] = useState<FlowInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"test" | "approve" | "pause" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  // العقدة المنقورة — تُفتح تفاصيلها أسفل الرسم
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/flows/${flowId}/ir`);
      if (!res.ok) return;
      const d = await res.json();
      setInfo({
        name: d.name ?? "",
        status: d.status,
        ir: d.ir ?? null,
        lastTest: d.last_test ?? null,
      });
    } catch {
      // تعذّر الجلب — نُبقي ما لدينا
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load, building, reloadKey]);

  // الاختبار غير متزامن: نتيجته تصل المحرك لاحقًا، فنستطلع ما دامت الحالة «Testing»
  useEffect(() => {
    if (info?.status !== "Testing") return;
    const timer = setInterval(() => {
      fetch(`/api/flows/${flowId}/reconcile`, { method: "POST" }).catch(() => {});
      load();
    }, 3500);
    return () => clearInterval(timer);
  }, [info?.status, flowId, load]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "تعذّر التنفيذ");
    return d as Record<string, unknown>;
  }

  /** يبني المسار إن لم يُبنَ بعد — يرجع رسالة العائق إن وُجد */
  async function ensureBuilt(): Promise<string | null> {
    if (status && !UNBUILT.includes(status)) return null;
    const d = await post(`/api/flows/${flowId}/build`, {});

    if (d.status === "NeedsConnections") {
      const names = ((d.missing ?? []) as Provider[])
        .map((p) => PROVIDER_LABELS[p] ?? p)
        .join("، ");
      return `ينقص ربط: ${names} — اربطه ثم أعد المحاولة.`;
    }
    if (d.status === "NeedsInformation") {
      const fields = Array.isArray(d.blocking)
        ? (d.blocking as { missing?: { label: string }[] }[])
            .flatMap((b) => b.missing ?? [])
            .map((m) => m.label)
            .join("، ")
        : ((d.missing_params as string) ?? "");
      return fields
        ? `ينقص المسار: ${fields} — اذكرها في المحادثة.`
        : "ينقص المسار معلومة — وضّحها في المحادثة.";
    }
    return null;
  }

  async function act(kind: "test" | "approve" | "pause") {
    setBusy(kind);
    setNotice(null);
    try {
      // الإيقاف لا يبني: المسار قائمٌ في المحرك وإلا لما كان مفعّلًا، والبناء
      // قبله يؤخّر إطفاءً هو المقصود بالضغط
      if (kind === "pause") {
        await post(`/api/flows/${flowId}/activate`, { action: "pause" });
        setNotice({ ok: true, text: "أُوقف المسار — لن يعمل في موعده حتى تشغّله من جديد" });
        await load();
        return;
      }

      // الاختبار يبني أولًا إن لزم، فلا يقف الزر معطّلًا على مسودة
      const blocked = await ensureBuilt();
      if (blocked) {
        setNotice({ ok: false, text: blocked });
        await load();
        return;
      }

      if (kind === "test") {
        await post(`/api/flows/${flowId}/test`, {});
        setNotice(null); // النتيجة نفسها تظهر أدناه متى وصلت
      } else {
        await post(`/api/flows/${flowId}/activate`, { action: "activate" });
        setNotice({ ok: true, text: "يعمل الآن ✓ — سينفّذ نفسه في موعده" });
      }
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(null);
    }
  }

  const status = info?.status;
  const testing = status === "Testing";
  const active = status === "Active";
  const selectedNode =
    (selectedId && info?.ir?.nodes.find((n) => n.id === selectedId)) || null;

  return (
    <div className="ws-canvas-inner">
      <header className="ws-bar">
        <span className="text-[0.9rem] font-bold truncate min-w-0">
          {info?.name || "سير العمل"}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => act("test")}
            disabled={busy !== null || testing || !status}
            className="btn btn-ghost text-[0.75rem] py-1.5"
            title="يبني المسار إن لزم ثم يشغّله تجريبيًا"
          >
            {busy === "test" || testing ? "جارٍ الاختبار…" : "اختبار"}
          </button>
          {/* مفتاحٌ واحد في موضعٍ واحد: يشغّل المسار فيصير «إيقاف»، ويوقفه
              فيعود «تشغيل». زرّان متجاوران — أحدهما يشغّل والآخر يوقف —
              يجعلان الحالة الراهنة لغزًا؛ والمفتاح يقولها بنفسه. */}
          {active ? (
            <button
              onClick={() => act("pause")}
              disabled={busy !== null || testing}
              className="btn btn-ghost text-[0.75rem] py-1.5"
              title="يطفئ موعده في المحرك فلا يعمل تلقائيًا حتى تشغّله من جديد"
            >
              {busy === "pause" ? "جارٍ الإيقاف…" : "إيقاف"}
            </button>
          ) : (
            <button
              onClick={() => act("approve")}
              disabled={busy !== null || testing || !status}
              className="btn btn-primary text-[0.75rem] py-1.5"
              title="يبني المسار إن لزم ثم يشغّله ليعمل في موعده تلقائيًا"
            >
              {busy === "approve" ? "…" : "تشغيل"}
            </button>
          )}
        </div>
      </header>

      {notice ? (
        <p
          className={`px-4 py-2 text-[0.75rem] border-b border-[var(--line-soft)] ${
            notice.ok ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {notice.text}
        </p>
      ) : testing ? (
        <p className="px-4 py-2 text-[0.75rem] border-b border-[var(--line-soft)] text-[var(--text-soft)]">
          جارٍ الاختبار — النتيجة خلال لحظات…
        </p>
      ) : info?.lastTest && info.lastTest.passed !== null ? (
        <p
          className={`px-4 py-2 text-[0.75rem] border-b border-[var(--line-soft)] ${
            info.lastTest.passed ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {info.lastTest.passed
            ? "نجح آخر اختبار ✓"
            : `فشل آخر اختبار: ${info.lastTest.error ?? "سبب غير معروف"}`}
        </p>
      ) : null}

      <div className="flex-1 min-h-0">
        {/* الرسم موجود قبل البناء (يصنعه التقييم)، فيُعرض وهو يتشكّل عقدةً
            بعد عقدة بدل شاشة انتظار تقول «بناء المسار» ولا تُري شيئًا */}
        {info?.ir ? (
          <ExecutionGraph ir={info.ir} height="100%" onSelect={setSelectedId} />
        ) : building || loading ? (
          <div className="h-full grid place-items-center">
            <NeuralThinking phase="building" />
          </div>
        ) : (
          <div className="h-full grid place-items-center text-[0.8rem] text-[var(--text-soft)]">
            لا يوجد رسم بعد.
          </div>
        )}
      </div>

      {/* تفاصيل العقدة المنقورة أسفل الرسم: يراها ويصحّح حقولها في موضعها،
          بدل جملةٍ في المحادثة تُعيد توليد المسار كلّه من أجل حقل واحد */}
      {selectedNode && (
        <NodeInspector
          node={selectedNode}
          flowId={flowId}
          onSaved={load}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
