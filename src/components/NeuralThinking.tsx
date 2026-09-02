"use client";

// شبكة صغيرة تنبض أثناء عمل وَتيرة.
// أبسط من سابقتها: ثلاث طبقات لا أربع (سبع عقد بدل ثلاث عشرة)، وحجم أصغر،
// وسطر واحد ثابت بدل أربع جمل متبدّلة لكل طور — الانتظار لا يحتاج سردًا.

import { useMemo } from "react";
import { useLang } from "@/lib/i18n";

type Phase = "thinking" | "evaluating" | "building";

const LAYERS = [2, 3, 2];
const W = 116;
const H = 50;

export default function NeuralThinking({ phase }: { phase: Phase }) {
  const { lang } = useLang();
  const label = lang === "en" ? "Thinking…" : "يفكّر…";

  const { nodes, edges } = useMemo(() => {
    const nodes: { x: number; y: number; layer: number }[] = [];
    LAYERS.forEach((count, li) => {
      const x = 10 + (li * (W - 20)) / (LAYERS.length - 1);
      for (let ni = 0; ni < count; ni++) {
        nodes.push({ x, y: (H * (ni + 1)) / (count + 1), layer: li });
      }
    });
    const edges: { x1: number; y1: number; x2: number; y2: number; k: number }[] = [];
    let k = 0;
    nodes.forEach((a) => {
      nodes
        .filter((b) => b.layer === a.layer + 1)
        .forEach((b) => edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, k: k++ }));
    });
    return { nodes, edges };
  }, []);

  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite" data-phase={phase}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 -scale-x-100" aria-hidden>
        {edges.map((e) => (
          <line
            key={e.k}
            className="nn-edge"
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0.75"
            style={{ animationDelay: `${(e.k % 5) * 0.16}s` }}
          />
        ))}
        {nodes.map((n, i) => (
          <circle
            key={i}
            className="nn-node"
            cx={n.x}
            cy={n.y}
            r="3.4"
            fill="var(--accent-bg)"
            style={{ animationDelay: `${(i % 4) * 0.3}s` }}
          />
        ))}
      </svg>
      <span className="text-[0.8rem] font-medium text-[var(--text-soft)] whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
