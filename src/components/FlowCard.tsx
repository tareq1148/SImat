import Link from "next/link";
import StatusChip from "./StatusChip";
import type { FlowRow, FlowStatus } from "@/lib/types";

// بطاقة مسار موحّدة: شريط حالة ملوّن على البداية + سهم فتح يظهر عند المرور

const STATUS_ACCENTS: Record<FlowStatus, string> = {
  Draft: "#94a3b8",
  NeedsInformation: "#f59e0b",
  NeedsConnections: "#f59e0b",
  ReadyToTest: "#22d3ee",
  Testing: "#22d3ee",
  NeedsRepair: "#f87171",
  Ready: "#34d399",
  Active: "#34d399",
  Paused: "#94a3b8",
  NotSuitable: "#f87171",
};

const TYPE_LABELS: Record<string, string> = {
  deterministic: "ثابت",
  ai_assisted: "ذكاء اصطناعي",
  agentic: "وكيلي",
  human_in_loop: "موافقة بشرية",
  browser_automation: "متصفح",
};

export default function FlowCard({ flow }: { flow: FlowRow }) {
  return (
    <Link
      href={`/flow/${flow.id}`}
      className="card p-5 border-s-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(34,211,238,0.10)] hover:border-cyan-400/40 group block"
      style={{ borderInlineStartColor: STATUS_ACCENTS[flow.status] ?? "#94a3b8" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-bold leading-snug">{flow.name}</h3>
        <StatusChip status={flow.status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
          {flow.evaluation && (
            <span className="chip border-slate-500/40 text-slate-300 bg-slate-500/10">
              الجدوى {flow.evaluation.score}/100
            </span>
          )}
          {(flow.solution_types ?? []).map((t) => (
            <span key={t} className="chip border-violet-400/30 text-violet-300 bg-violet-400/5">
              {TYPE_LABELS[t] ?? t}
            </span>
          ))}
        </div>
        <span className="text-xs text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          فتح ←
        </span>
      </div>
    </Link>
  );
}
