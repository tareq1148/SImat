"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { IRNode, Provider, WorkflowIR } from "@/lib/types";

interface NodeData extends Record<string, unknown> {
  ir: IRNode;
  connected: boolean;
  onSelect: (n: IRNode) => void;
}

// تصنيف لاتيني صغير فوق العنوان — أسلوب لوحات الأتمتة العالمية
function category(ir: IRNode): string {
  if (ir.provider) {
    const map: Record<Provider, string> = {
      gmail: "GMAIL",
      google_sheets: "SHEETS",
      google_drive: "DRIVE",
      openai: "AI",
      telegram: "TELEGRAM",
      slack: "SLACK",
      instagram: "INSTAGRAM",
      tiktok: "TIKTOK",
    };
    return map[ir.provider];
  }
  if (ir.type === "trigger") return "TRIGGER";
  if (ir.type === "approval") return "APPROVAL";
  if (ir.type === "output") return "OUTPUT";
  return "LOGIC";
}

// رمز أبيض داخل المربع الملون
function Glyph({ ir }: { ir: IRNode }) {
  const key = ir.provider ?? ir.type;
  const paths: Record<string, React.ReactNode> = {
    trigger: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />,
    approval: <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3zM9.5 12l2 2 3.5-4" />,
    output: <path d="m5 12 5 5L20 7" />,
    logic: <path d="M12 4v5m0 0-4 4m4-4 4 4M8 13v3m8-3v3M8 19h.01M16 19h.01" />,
    gmail: <path d="M3 6h18v12H3zM3 7l9 6 9-6" />,
    google_sheets: <path d="M5 4h14v16H5zM5 10h14M5 15h14M12 10v10" />,
    google_drive: <path d="M9 4h6l6 10-3 6H6l-3-6L9 4zM9 4l6 10M15 4 9 14M3.5 14h11" />,
    openai: <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5 8.6 8.6M15.4 15.4l2.1 2.1M17.5 6.5l-2.1 2.1M8.6 15.4l-2.1 2.1M12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />,
    telegram: <path d="m21 4-4 16-6.5-4.5L7 19l-.5-5L21 4zM21 4 6.5 14" />,
    slack: <path d="M9 4v7M15 13v7M4 15h7M13 9h7M9 4a1.8 1.8 0 1 0-1.8 1.8M15 20a1.8 1.8 0 1 0 1.8-1.8M4 15a1.8 1.8 0 1 0 1.8 1.8M20 9a1.8 1.8 0 1 0-1.8-1.8" />,
    instagram: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.5" />
        <circle cx="17" cy="7" r="0.5" fill="white" />
      </>
    ),
    tiktok: <path d="M14 4v9.5a3.8 3.8 0 1 1-3.8-3.8M14 4c.4 2.6 2 4.2 4.5 4.5" />,
  };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[key] ?? paths.logic}
    </svg>
  );
}

function AppNode({ data }: NodeProps<Node<NodeData>>) {
  const { ir, connected } = data;
  const needsConn = ir.provider !== null && !connected;
  const isApproval = ir.type === "approval";

  return (
    <div
      dir="rtl"
      onClick={() => data.onSelect(ir)}
      title={needsConn ? "يحتاج ربط الحساب" : ir.operation}
      className="relative bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3.5 py-3 min-w-[150px] max-w-[190px] cursor-pointer transition-colors duration-150 hover:border-[var(--accent-bg)]"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <Handle type="target" position={Position.Right} className="!bg-[var(--edge)] !w-1.5 !h-1.5 !border-0" />
      {(needsConn || ir.sensitive !== "none") && (
        <span
          className="absolute top-2 end-2 status-dot"
          style={{ background: needsConn ? "var(--warn)" : "var(--bad)" }}
          title={needsConn ? "يحتاج ربط الحساب" : "إجراء حساس — بموافقتك"}
        />
      )}
      <div className="flex items-center gap-2.5">
        <span
          className={`${isApproval ? "" : "mark"} shrink-0 w-[30px] h-[30px] rounded-[9px] flex items-center justify-center`}
          style={
            isApproval
              ? { background: "linear-gradient(145deg,#fcd34d,#d97706)", color: "#4a2a02" }
              : undefined
          }
        >
          <Glyph ir={ir} />
        </span>
        <span className="min-w-0">
          <span
            dir="ltr"
            className="block text-[0.55rem] font-semibold tracking-[0.08em] text-[var(--text-soft)] leading-none mb-1 text-right"
          >
            {category(ir)}
          </span>
          <span className="block text-[0.8rem] font-semibold leading-tight truncate">
            {ir.label}
          </span>
        </span>
      </div>
      <Handle type="source" position={Position.Left} className="!bg-[var(--edge)] !w-1.5 !h-1.5 !border-0" />
    </div>
  );
}

const nodeTypes = { app: AppNode };

export default function FlowCanvas({
  ir,
  connectedProviders,
  onSelect,
}: {
  ir: WorkflowIR;
  connectedProviders: Provider[];
  onSelect: (n: IRNode) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    // ترتيب طولي من اليمين إلى اليسار (اتجاه القراءة العربية)، وتفريع رأسي عند تعدد الأهداف
    const order = new Map<string, number>();
    const lane = new Map<string, number>();
    let idx = 0;
    const walk = (id: string, depth: number) => {
      if (order.has(id)) return;
      order.set(id, idx++);
      const targets = ir.edges.filter((e) => e.source === id);
      targets.forEach((e, i) => {
        if (!lane.has(e.target))
          lane.set(e.target, targets.length > 1 ? i * 2 - (targets.length - 1) : (lane.get(id) ?? 0));
        walk(e.target, depth + 1);
      });
    };
    const start = ir.nodes.find((n) => n.type === "trigger");
    if (start) {
      lane.set(start.id, 0);
      walk(start.id, 0);
    }
    ir.nodes.forEach((n) => walk(n.id, 0));

    const nodes: Node<NodeData>[] = ir.nodes.map((n) => ({
      id: n.id,
      type: "app",
      position: {
        x: -(order.get(n.id) ?? 0) * 235,
        y: (lane.get(n.id) ?? 0) * 55 + ((order.get(n.id) ?? 0) % 2) * 14,
      },
      data: {
        ir: n,
        connected: n.provider ? connectedProviders.includes(n.provider) : true,
        onSelect,
      },
    }));

    const edges: Edge[] = ir.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label ?? undefined,
      type: "default",
      animated: true,
      style: { stroke: "var(--edge)", strokeWidth: 1.5 },
      labelStyle: { fill: "var(--text-soft)", fontSize: 10 },
      labelBgStyle: { fill: "var(--surface)" },
    }));

    return { nodes, edges };
  }, [ir, connectedProviders, onSelect]);

  return (
    <div className="h-[440px] rounded-2xl overflow-hidden border border-[var(--line)] bg-[var(--panel-solid)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="var(--edge)"
          gap={18}
          size={1.4}
        />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
