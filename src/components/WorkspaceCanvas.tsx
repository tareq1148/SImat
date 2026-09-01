"use client";

// لوحة المسار (75%) — تظهر بجوار المحادثة المرساة.
// عرض للقراءة فقط: تصفّح وتفتيش بلا سحب عقد ولا تحرير.
// في شريطها زرّان لا ثالث لهما: اختبار ثم اعتماد.

import { useCallback, useEffect, useState } from "react";
import ExecutionGraph from "./ExecutionGraph";
import StatusChip from "./StatusChip";
import NeuralThinking from "./NeuralThinking";
import type { FlowStatus, WorkflowIR } from "@/lib/types";

interface FlowInfo {
  name: string;
  status: FlowStatus;
  ir: WorkflowIR | null;
}

/** الاعتماد يشترطه الخادم بعد نجاح الاختبار — نعكس الشرط نفسه في الزر */
const APPROVABLE: FlowStatus[] = ["Ready", "Paused"];
/** لا اختبار قبل أن يوجد المسار في المحرك */
const TESTABLE: FlowStatus[] = ["ReadyToTest", "NeedsRepair", "Ready", "Active", "Paused"];

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
  const [busy, setBusy] = useState<"test" | "approve" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/flows/${flowId}/ir`);
      if (!res.ok) return;
      const d = await res.json();
      setInfo({ name: d.name ?? "", status: d.status, ir: d.ir ?? null });
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

  async function act(kind: "test" | "approve") {
    setBusy(kind);
    setNotice(null);
    try {
      const url =
        kind === "test"
          ? `/api/flows/${flowId}/test`
          : `/api/flows/${flowId}/activate`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "test" ? {} : { action: "activate" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "تعذّر التنفيذ");
      setNotice({
        ok: true,
        text: kind === "test" ? "بدأ الاختبار — النتيجة خلال لحظات…" : "تم الاعتماد ✓",
      });
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

  return (
    <div className="ws-canvas-inner">
      <header className="ws-bar">
        <div className="min-w-0 flex items-center gap-2.5">
          <span className="text-[0.9rem] font-bold truncate">
            {info?.name || "سير العمل"}
          </span>
          {status && <StatusChip status={status} />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => act("test")}
            disabled={busy !== null || testing || !status || !TESTABLE.includes(status)}
            className="btn btn-ghost text-[0.75rem] py-1.5"
            title={
              status && TESTABLE.includes(status)
                ? "شغّل تشغيلًا تجريبيًا"
                : "ابنِ المسار وأكمل ارتباطاته أولًا"
            }
          >
            {busy === "test" || testing ? "جارٍ الاختبار…" : "اختبار"}
          </button>
          <button
            onClick={() => act("approve")}
            disabled={busy !== null || active || !status || !APPROVABLE.includes(status)}
            className="btn btn-primary text-[0.75rem] py-1.5"
            title={
              active
                ? "المسار معتمد ويعمل"
                : status && APPROVABLE.includes(status)
                  ? "اعتمد المسار ليعمل تلقائيًا"
                  : "الاعتماد بعد نجاح الاختبار"
            }
          >
            {busy === "approve" ? "…" : active ? "معتمد ✓" : "اعتماد"}
          </button>
        </div>
      </header>

      {notice && (
        <p
          className={`px-4 py-2 text-[0.75rem] border-b border-[var(--line-soft)] ${
            notice.ok ? "text-emerald-300" : "text-amber-300"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="flex-1 min-h-0 p-3">
        {building ? (
          <div className="h-full grid place-items-center">
            <NeuralThinking phase="building" />
          </div>
        ) : loading ? (
          <div className="h-full grid place-items-center text-[0.8rem] text-[var(--text-soft)]">
            جارٍ تحميل الرسم…
          </div>
        ) : info?.ir ? (
          <ExecutionGraph ir={info.ir} height="100%" />
        ) : (
          <div className="h-full grid place-items-center text-[0.8rem] text-[var(--text-soft)]">
            لا يوجد رسم بعد.
          </div>
        )}
      </div>
    </div>
  );
}
