import { STATUS_LABELS, type FlowStatus } from "@/lib/types";

const COLORS: Record<FlowStatus, string> = {
  Draft: "border-slate-500/40 text-slate-300 bg-slate-500/10",
  NeedsInformation: "border-amber-400/40 text-amber-300 bg-amber-400/10",
  NeedsConnections: "border-amber-400/40 text-amber-300 bg-amber-400/10",
  ReadyToTest: "border-cyan-400/40 text-cyan-300 bg-cyan-400/10",
  Testing: "border-cyan-400/40 text-cyan-300 bg-cyan-400/10",
  NeedsRepair: "border-red-400/40 text-red-300 bg-red-400/10",
  Ready: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
  Active: "border-emerald-400/60 text-emerald-300 bg-emerald-400/15",
  Paused: "border-slate-400/40 text-slate-300 bg-slate-400/10",
  NotSuitable: "border-red-400/40 text-red-300 bg-red-400/10",
};

export default function StatusChip({ status }: { status: FlowStatus }) {
  return (
    <span className={`chip ${COLORS[status] ?? COLORS.Draft}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
