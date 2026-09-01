"use client";

// لوحة المسار (75%) — تظهر بجوار المحادثة المرساة.
// عرض للقراءة فقط: تصفّح وتفتيش بلا سحب عقد ولا تحرير.
// في شريطها زرّان لا ثالث لهما: اختبار ثم اعتماد.

import { useCallback, useEffect, useState } from "react";
import ExecutionGraph from "./ExecutionGraph";
import NeuralThinking from "./NeuralThinking";
import { PROVIDER_LABELS, type FlowStatus, type Provider, type WorkflowIR } from "@/lib/types";

interface FlowInfo {
  name: string;
  status: FlowStatus;
  ir: WorkflowIR | null;
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

  async function act(kind: "test" | "approve") {
    setBusy(kind);
    setNotice(null);
    try {
      // الاختبار يبني أولًا إن لزم، فلا يقف الزر معطّلًا على مسودة
      const blocked = await ensureBuilt();
      if (blocked) {
        setNotice({ ok: false, text: blocked });
        await load();
        return;
      }

      if (kind === "test") {
        await post(`/api/flows/${flowId}/test`, {});
        setNotice({ ok: true, text: "بدأ الاختبار — النتيجة خلال لحظات…" });
      } else {
        await post(`/api/flows/${flowId}/activate`, { action: "activate" });
        setNotice({ ok: true, text: "تم الاعتماد ✓" });
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
          <button
            onClick={() => act("approve")}
            disabled={busy !== null || testing || active || !status}
            className="btn btn-primary text-[0.75rem] py-1.5"
            title={active ? "المسار معتمد ويعمل" : "يبني المسار إن لزم ثم يعتمده ليعمل تلقائيًا"}
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

      <div className="flex-1 min-h-0">
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
