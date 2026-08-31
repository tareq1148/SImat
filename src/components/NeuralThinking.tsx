"use client";

// شبكة عصبية حية أثناء عمل سِمَاط — نبضات تسري بين العقد + سطر يخبر المستخدم بما يحدث الآن
// الهدف: طمأنة ومتعة بدل نقاط انتظار صمّاء

import { useEffect, useMemo, useState } from "react";
import { useLang, type Lang } from "@/lib/i18n";

type Phase = "thinking" | "evaluating" | "building";

const PHASE_LABELS: Record<Lang, Record<Phase, string[]>> = {
  ar: {
    thinking: ["نقرأ رسالتك…", "نحلل المهمة…", "نرسم الخطوات…", "نلتقط التفاصيل المهمة…"],
    evaluating: ["نفحص بوابات الجدوى…", "نحسب عوامل الأتمتة…", "نحدد نوع الحل الأنسب…", "نصيغ التفسير…"],
    building: ["نحوّل الرسم إلى عقد تنفيذ…", "نربط التكاملات بحساباتك…", "نضيف بوابات الموافقة…", "ننشر في محرك التنفيذ…"],
  },
  en: {
    thinking: ["Reading your message…", "Analyzing the task…", "Mapping the steps…", "Capturing key details…"],
    evaluating: ["Checking feasibility gates…", "Scoring automation factors…", "Picking the best solution…", "Writing the explanation…"],
    building: ["Turning the map into nodes…", "Wiring your integrations…", "Adding approval gates…", "Deploying to the engine…"],
  },
};

const LAYERS = [3, 4, 4, 2];
const W = 210;
const H = 84;

export default function NeuralThinking({ phase }: { phase: Phase }) {
  const { lang } = useLang();
  const [idx, setIdx] = useState(0);
  const labels = PHASE_LABELS[lang][phase];

  useEffect(() => {
    setIdx(0);
    const t = setInterval(() => setIdx((i) => (i + 1) % labels.length), 1900);
    return () => clearInterval(t);
  }, [phase, labels.length]);

  const { nodes, edges } = useMemo(() => {
    const nodes: { x: number; y: number; layer: number }[] = [];
    LAYERS.forEach((count, li) => {
      const x = 16 + (li * (W - 32)) / (LAYERS.length - 1);
      for (let ni = 0; ni < count; ni++) {
        const y = (H * (ni + 1)) / (count + 1);
        nodes.push({ x, y, layer: li });
      }
    });
    const edges: { x1: number; y1: number; x2: number; y2: number; k: number }[] = [];
    let k = 0;
    nodes.forEach((a) => {
      nodes
        .filter((b) => b.layer === a.layer + 1)
        .forEach((b) => {
          edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, k: k++ });
        });
    });
    return { nodes, edges };
  }, []);

  return (
    <div className="flex items-center gap-4">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="shrink-0 -scale-x-100"
        aria-hidden
      >
        {edges.map((e) => (
          <line
            key={`b${e.k}`}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="var(--edge)"
            strokeWidth="0.7"
            opacity="0.5"
          />
        ))}
        {edges
          .filter((e) => e.k % 3 === 0)
          .map((e) => (
            <line
              key={`p${e.k}`}
              className="nn-edge"
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="var(--accent)"
              strokeWidth="1.1"
              style={{ animationDelay: `${(e.k % 7) * 0.18}s` }}
            />
          ))}
        {nodes.map((n, i) => (
          <circle
            key={i}
            className="nn-node"
            cx={n.x}
            cy={n.y}
            r={n.layer === LAYERS.length - 1 ? 5 : 4}
            fill={n.layer === LAYERS.length - 1 ? "#a78bfa" : "var(--accent-bg)"}
            style={{ animationDelay: `${(i % 5) * 0.28}s` }}
          />
        ))}
      </svg>
      <span
        key={idx}
        className="rise text-[0.8rem] font-medium text-[var(--text-soft)] whitespace-nowrap"
      >
        {labels[idx]}
      </span>
    </div>
  );
}
