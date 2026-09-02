"use client";

// مؤشّر انتظار: أربع عقد نابضة — الأولى تصل الثانية، والثانية تتفرّع إلى اثنتين.
// الشكل مرسوم صراحةً لا مولَّدًا من طبقات: البنية ثابتة فلا حاجة إلى حساب.

import { useLang } from "@/lib/i18n";

type Phase = "thinking" | "evaluating" | "building";

const W = 108;
const H = 44;

// x, y لكل عقدة — والـSVG معكوس أفقيًا فيسري من اليمين لليسار كاتجاه القراءة
const N1 = { x: 10, y: H / 2 };
const N2 = { x: 54, y: H / 2 };
const N3 = { x: 98, y: 12 };
const N4 = { x: 98, y: H - 12 };

const NODES = [N1, N2, N3, N4];
const EDGES = [
  { a: N1, b: N2 },
  { a: N2, b: N3 },
  { a: N2, b: N4 },
];

export default function NeuralThinking({ phase }: { phase: Phase }) {
  const { lang } = useLang();
  const label = lang === "en" ? "Thinking…" : "يفكّر…";

  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-live="polite"
      data-phase={phase}
    >
      <span className="text-[0.8rem] font-medium text-[var(--text-soft)] whitespace-nowrap">
        {label}
      </span>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="shrink-0 -scale-x-100"
        aria-hidden
      >
        {EDGES.map((e, i) => (
          <line
            key={i}
            className="nn-edge"
            x1={e.a.x}
            y1={e.a.y}
            x2={e.b.x}
            y2={e.b.y}
            stroke="var(--accent)"
            strokeWidth="1.1"
            opacity="0.8"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
        {NODES.map((n, i) => (
          <circle
            key={i}
            className="nn-node"
            cx={n.x}
            cy={n.y}
            r="4"
            fill="var(--accent-bg)"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
