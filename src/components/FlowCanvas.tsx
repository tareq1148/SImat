"use client";

import { useMemo } from "react";
import {
  Background,
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
import { providerIcon } from "./icons";

interface NodeData extends Record<string, unknown> {
  ir: IRNode;
  connected: boolean;
  onSelect: (n: IRNode) => void;
}

function AppNode({ data }: NodeProps<Node<NodeData>>) {
  const { ir, connected } = data;
  const needsConn = ir.provider !== null && !connected;
  const border =
    ir.type === "approval"
      ? "border-amber-400/60"
      : needsConn
        ? "border-amber-400/50"
        : ir.type === "trigger" || ir.type === "output"
          ? "border-cyan-400/40"
          : "border-[var(--edge)]";

  return (
    <div
      dir="rtl"
      onClick={() => data.onSelect(ir)}
      className={`card ${border} px-4 py-3 w-56 cursor-pointer hover:border-cyan-300/70 transition-colors`}
    >
      <Handle type="target" position={Position.Right} className="!bg-[var(--edge)] !w-2 !h-2" />
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--well)] border border-[var(--line)] flex items-center justify-center">
          {providerIcon(ir.provider ?? ir.type, 20)}
        </div>
        <div className="min-w-0">
          <div className="text-[0.8rem] font-bold leading-tight truncate">{ir.label}</div>
          <div className="text-[0.65rem] text-slate-400 truncate">{ir.operation}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {ir.provider && (
          <span
            className={`chip text-[0.6rem] px-2 py-0 ${
              connected
                ? "border-emerald-400/40 text-emerald-300 bg-emerald-400/10"
                : "border-amber-400/50 text-amber-300 bg-amber-400/10"
            }`}
          >
            {connected ? "متصل" : "يحتاج اتصالًا"}
          </span>
        )}
        {ir.sensitive !== "none" && (
          <span className="chip text-[0.6rem] px-2 py-0 border-red-400/40 text-red-300 bg-red-400/10">
            {ir.sensitive === "send" ? "إرسال" : "حذف"} — بموافقتك
          </span>
        )}
        {ir.type === "approval" && (
          <span className="chip text-[0.6rem] px-2 py-0 border-amber-400/50 text-amber-300 bg-amber-400/10">
            بوابة موافقة
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Left} className="!bg-[var(--edge)] !w-2 !h-2" />
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
    // ترتيب طولي من اليمين إلى اليسار (اتجاه القراءة العربية)
    const order = new Map<string, number>();
    let idx = 0;
    const walk = (id: string) => {
      if (order.has(id)) return;
      order.set(id, idx++);
      ir.edges.filter((e) => e.source === id).forEach((e) => walk(e.target));
    };
    const start = ir.nodes.find((n) => n.type === "trigger");
    if (start) walk(start.id);
    ir.nodes.forEach((n) => walk(n.id));

    const nodes: Node<NodeData>[] = ir.nodes.map((n) => ({
      id: n.id,
      type: "app",
      position: { x: -(order.get(n.id) ?? 0) * 280, y: (order.get(n.id) ?? 0) % 2 === 0 ? 0 : 46 },
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
      animated: true,
      labelStyle: { fill: "var(--text-soft)", fontSize: 10 },
      labelBgStyle: { fill: "var(--well)" },
    }));

    return { nodes, edges };
  }, [ir, connectedProviders, onSelect]);

  return (
    <div className="h-[440px] rounded-2xl overflow-hidden border border-[var(--line)] bg-[var(--well)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="var(--line-soft)" gap={22} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
