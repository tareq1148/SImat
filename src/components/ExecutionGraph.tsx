"use client";

// رسم تنفيذ للقراءة فقط — عرض بصري خالص لمسار الأتمتة.
// لا سحب ولا إضافة ولا حذف ولا توصيل: تحريك اللوحة والتقريب والملاءمة فقط.
// يقبل IR حقيقيًا، وإن لم يُعطَ يعرض مسار العرض: محفّز ← وكيل ← Gmail.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { IRNode, WorkflowIR } from "@/lib/types";
import { providerIcon } from "./icons";

export type RunState = "idle" | "running" | "success" | "error";

const STATE_STYLE: Record<RunState, { label: string; color: string }> = {
  idle: { label: "خامل", color: "var(--edge)" },
  running: { label: "يعمل", color: "var(--accent-bg)" },
  success: { label: "نجح", color: "var(--ok)" },
  error: { label: "فشل", color: "var(--bad)" },
};

interface NodeData extends Record<string, unknown> {
  title: string;
  action: string;
  glyph: string;
  state: RunState;
}

/** ما له شعار علامة حقيقي — البقية ترتدّ إلى الرمز الهندسي */
const BRANDED = new Set([
  "gmail",
  "google_sheets",
  "google_drive",
  "google_docs",
  "google_slides",
  "google_calendar",
  "openai",
  "telegram",
  "slack",
  "instagram",
  "tiktok",
  "removebg",
]);

function Glyph({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    webhook: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />,
    ai: (
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5 8.6 8.6M15.4 15.4l2.1 2.1M17.5 6.5l-2.1 2.1M8.6 15.4l-2.1 2.1M12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
    ),
    gmail: <path d="M3 6h18v12H3zM3 7l9 6 9-6" />,
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
    n8n: <path d="M5 12a2 2 0 1 0 0-.1M19 6a2 2 0 1 0 0-.1M19 18a2 2 0 1 0 0-.1M12 12h5M7 12h3M12 12 17 6M12 12l5 6" />,
    drive: <path d="M9 4h6l6 10-3 6H6l-3-6L9 4zM9 4l6 10M15 4 9 14M3.5 14h11" />,
    sheets: <path d="M5 4h14v16H5zM5 10h14M5 15h14M12 10v10" />,
    slides: <path d="M4 5h16v11H4zM12 16v3M8.5 19h7M8 9h8M8 12h5" />,
    calendar: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8.5 14h2M13.5 14h2" />,
    docs: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 15h6M9 18h4" />,
    approval: <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3zM9.5 12l2 2 3.5-4" />,
    output: <path d="m5 12 5 5L20 7" />,
    logic: <path d="M12 4v5m0 0-4 4m4-4 4 4M8 13v3m8-3v3M8 19h.01M16 19h.01" />,
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? paths.logic}
    </svg>
  );
}

// بطاقة العقدة — زجاجية: تمويه خلفي وحد فاتح وظل عميق
function GraphNode({ data }: NodeProps<Node<NodeData>>) {
  const s = STATE_STYLE[data.state];
  return (
    <div dir="rtl" className="xg-node" title={`${data.title} — ${data.action}`}>
      {/* المقابض مخفية: لا توصيل في وضع القراءة، لكن الحواف تحتاج نقاط ارتساء */}
      <Handle type="target" position={Position.Right} className="xg-handle" isConnectable={false} />

      {/* الحالة تُلوّن حلقة الدائرة بدل شارة نصّية — لا عنصر ثالث في العقدة */}
      <span
        className={`xg-icon ${data.state === "running" ? "is-running" : ""}`}
        style={{ ["--xg-state" as string]: s.color }}
        data-state={data.state}
        data-brand={data.glyph}
      >
        {BRANDED.has(data.glyph) ? (
          providerIcon(data.glyph, 24)
        ) : (
          <Glyph name={data.glyph} />
        )}
      </span>
      <span className="xg-title">{data.title}</span>

      <Handle type="source" position={Position.Left} className="xg-handle" isConnectable={false} />
    </div>
  );
}

// حافة منحنية — وجزيء ضوء يسري عليها عندما يكون المصدر قيد التنفيذ
function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const live = (data as { live?: boolean } | undefined)?.live;

  return (
    <>
      <BaseEdge id={id} path={path} className="xg-edge" />
      {live && (
        <circle r="3.2" className="xg-particle">
          <animateMotion dur="1.8s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  );
}

const nodeTypes = { graph: GraphNode };
const edgeTypes = { graph: GraphEdge };

// ===== مسار العرض: طلب المستخدم ← المنسّق ← المحرك ← خدمات جوجل =====
const DEMO_NODES: { id: string; title: string; action: string; glyph: string; state: RunState }[] = [
  { id: "user", title: "طلب المستخدم", action: "أنشئ عرضًا واحجز موعدًا", glyph: "user", state: "success" },
  { id: "agent", title: "المنسّق الذكي", action: "يختار الأدوات", glyph: "ai", state: "success" },
  { id: "n8n", title: "محرّك n8n", action: "ينفّذ الإجراءات", glyph: "n8n", state: "running" },
  { id: "drive", title: "Drive", action: "drive:create", glyph: "google_drive", state: "idle" },
  { id: "sheets", title: "Sheets", action: "sheets:append", glyph: "google_sheets", state: "idle" },
  { id: "slides", title: "Slides", action: "slides:create", glyph: "slides", state: "idle" },
  { id: "calendar", title: "Calendar", action: "calendar:createEvent", glyph: "calendar", state: "idle" },
  { id: "docs", title: "Docs", action: "docs:create", glyph: "docs", state: "idle" },
];

const LEAVES = ["drive", "sheets", "slides", "calendar", "docs"];

/** سلسلة أفقية للثلاثة الأولى، ثم تفريع رأسي للخدمات الخمس */
function demoGraph(states: Record<string, RunState>): {
  nodes: Node<NodeData>[];
  edges: Edge[];
} {
  const nodes: Node<NodeData>[] = DEMO_NODES.map((d) => {
    const leafIdx = LEAVES.indexOf(d.id);
    const chainIdx = ["user", "agent", "n8n"].indexOf(d.id);
    return {
      id: d.id,
      type: "graph",
      position:
        leafIdx >= 0
          ? { x: -3 * 210, y: (leafIdx - 2) * 96 }
          : { x: -chainIdx * 210, y: 0 },
      data: {
        title: d.title,
        action: d.action,
        glyph: d.glyph,
        state: states[d.id] ?? d.state,
      },
    };
  });

  const chain: Edge[] = [
    { id: "e-ua", source: "user", target: "agent", type: "graph", data: { live: true } },
    { id: "e-an", source: "agent", target: "n8n", type: "graph", data: { live: true } },
  ];
  // فرع الخدمة يتحرّك فقط حين تكون قيد التنفيذ — لا نُضيء ما لم يبدأ
  const leaves: Edge[] = LEAVES.map((id) => ({
    id: `e-n-${id}`,
    source: "n8n",
    target: id,
    type: "graph",
    data: { live: (states[id] ?? "idle") === "running" },
  }));

  return { nodes, edges: [...chain, ...leaves] };
}

function irToGraph(ir: WorkflowIR): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const glyphOf = (n: IRNode) =>
    n.provider && BRANDED.has(n.provider)
      ? n.provider
      : n.type === "trigger"
        ? "webhook"
        : n.type === "approval"
          ? "approval"
          : n.type === "output"
            ? "output"
            : n.provider === "openai" || n.type === "openai"
              ? "ai"
              : "logic";

  // ترتيب أفقي من اليمين لليسار — اتجاه القراءة العربية
  const order = new Map<string, number>();
  let i = 0;
  const walk = (id: string) => {
    if (order.has(id)) return;
    order.set(id, i++);
    ir.edges.filter((e) => e.source === id).forEach((e) => walk(e.target));
  };
  const start = ir.nodes.find((n) => n.type === "trigger");
  if (start) walk(start.id);
  ir.nodes.forEach((n) => walk(n.id));

  return {
    nodes: ir.nodes.map((n) => ({
      id: n.id,
      type: "graph",
      position: { x: -(order.get(n.id) ?? 0) * 210, y: ((order.get(n.id) ?? 0) % 2) * 20 },
      data: { title: n.label, action: n.operation, glyph: glyphOf(n), state: "idle" as RunState },
    })),
    edges: ir.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "graph",
      data: { live: false },
    })),
  };
}

export default function ExecutionGraph({
  ir,
  height = 420,
  serviceStates,
}: {
  /** رسم حقيقي؛ بدونه يُعرض مسار المعمارية */
  ir?: WorkflowIR | null;
  height?: number | string;
  /** حالات حيّة تصل من المحرك (drive/sheets/slides/calendar/docs) */
  serviceStates?: Record<string, RunState>;
}) {

  // التحديد يُدار هنا: React Flow لا يضيف صنف selected بالنقر ما دام السحب معطّلًا
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<Node<NodeData>, Edge> | null>(null);

  // الملاءمة تُحسب عند التركيب، وقد تتمدّد الحاوية بعدها (انتقال مساحة العمل)
  // فتخرج العقد عن الإطار — نراقب المقاس ونعيد الملاءمة حتى يستقر.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => rfRef.current?.fitView({ padding: 0.28 }));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const { nodes, edges } = useMemo(() => {
    const base = ir ? irToGraph(ir) : demoGraph(serviceStates ?? {});
    base.nodes = base.nodes.map((n) => ({ ...n, selected: n.id === selectedId }));
    return base;
  }, [ir, serviceStates, selectedId]);

  return (
    <div className="xg-canvas" style={{ height }} ref={wrapRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        onInit={(inst) => {
          rfRef.current = inst;
        }}
        proOptions={{ hideAttribution: true }}
        /* وضع القراءة: لا سحب ولا توصيل ولا حذف — التحديد فقط للاستكشاف */
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, n) => setSelectedId((cur) => (cur === n.id ? null : n.id))}
        onPaneClick={() => setSelectedId(null)}
        edgesFocusable={false}
        deleteKeyCode={null}
        panOnDrag
        zoomOnScroll
      >
        <Background variant={BackgroundVariant.Dots} className="xg-bg" gap={22} size={1.5} />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}
