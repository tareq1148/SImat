"use client";

// لوحة المسار (75%) — تظهر بعد توليد سير العمل بجوار المحادثة المرساة.
// عرض للقراءة فقط: تصفّح وتفتيش بلا سحب عقد ولا تحرير.

import { useEffect, useState } from "react";
import ExecutionGraph from "./ExecutionGraph";
import StatusChip from "./StatusChip";
import NeuralThinking from "./NeuralThinking";
import type { FlowStatus, WorkflowIR } from "@/lib/types";

interface FlowInfo {
  name: string;
  status: FlowStatus;
  ir: WorkflowIR | null;
}

export default function WorkspaceCanvas({
  flowId,
  building,
  onDeploy,
  onOpenFull,
}: {
  flowId: string;
  building: boolean;
  onDeploy: () => void;
  onOpenFull: () => void;
}) {
  const [info, setInfo] = useState<FlowInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // تُقرأ عند التركيب، وتُعاد القراءة بعد البناء لأن الحالة تتغيّر في الخادم.
  // الحارس alive يمنع ردًّا متأخّرًا من الكتابة فوق مسارٍ صار غير معروض.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/flows/${flowId}/ir`);
        if (!res.ok || !alive) return;
        const d = await res.json();
        if (!alive) return;
        setInfo({ name: d.name ?? "", status: d.status, ir: d.ir ?? null });
      } catch {
        // تعذّر الجلب — نُبقي ما لدينا
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [flowId, building]);

  const deployable =
    info?.status === "Draft" ||
    info?.status === "NeedsConnections" ||
    info?.status === "NeedsInformation";

  return (
    <div className="ws-canvas-inner">
      <header className="ws-bar">
        <div className="min-w-0 flex items-center gap-2.5">
          <span className="text-[0.9rem] font-bold truncate">
            {info?.name || "سير العمل"}
          </span>
          {info?.status && <StatusChip status={info.status} />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onOpenFull} className="btn btn-ghost text-[0.72rem] py-1.5">
            افتح كاملًا
          </button>
          <button
            onClick={() => onDeploy()}
            disabled={building}
            className="btn btn-primary text-[0.75rem] py-1.5"
            title={deployable ? "ابنِ المسار في محرّك التنفيذ" : "أعد البناء"}
          >
            {building ? "جارٍ البناء…" : deployable ? "شغّل" : "أعد البناء"}
          </button>
        </div>
      </header>

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
