import Link from "next/link";
import StatusChip from "./StatusChip";
import type { FlowRow } from "@/lib/types";

// بطاقة مسار موحّدة — هدوء بصري: شارات محايدة وسهم فتح عند المرور

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
      className="card p-5 transition-colors duration-150 hover:border-[var(--accent-bg)] group block"
    >
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <h3 className="font-semibold text-[0.92rem] leading-snug">{flow.name}</h3>
        <StatusChip status={flow.status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {flow.evaluation && (
            <span className="chip chip-neutral">الجدوى {flow.evaluation.score}/100</span>
          )}
          {(flow.solution_types ?? []).map((t) => (
            <span key={t} className="chip chip-neutral">
              {TYPE_LABELS[t] ?? t}
            </span>
          ))}
        </div>
        <span className="text-[0.75rem] font-medium text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          فتح ←
        </span>
      </div>
    </Link>
  );
}
