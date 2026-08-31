import { STATUS_LABELS, type FlowStatus } from "@/lib/types";

// نمط النقطة: اللون في نقطة صغيرة فقط والنص محايد — هدوء بصري مهما تعددت الحالات
const DOTS: Record<FlowStatus, string> = {
  Draft: "var(--edge)",
  NeedsInformation: "var(--warn)",
  NeedsConnections: "var(--warn)",
  ReadyToTest: "var(--accent)",
  Testing: "var(--accent)",
  NeedsRepair: "var(--bad)",
  Ready: "var(--ok)",
  Active: "var(--ok)",
  Paused: "var(--edge)",
  NotSuitable: "var(--bad)",
};

export default function StatusChip({ status }: { status: FlowStatus }) {
  return (
    <span className="chip chip-neutral whitespace-nowrap">
      <span
        className="status-dot"
        style={{ background: DOTS[status] ?? "var(--edge)" }}
      />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
