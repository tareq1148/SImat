"use client";

// مخطط أعمدة أسبوعي — سلسلة واحدة، لون معتمد بفحوصات إتاحة اللون (#0891b2 على var(--well))

import { useState } from "react";

export interface WeekDatum {
  label: string;
  closed: number;
  minutes_saved: number;
}

const BAR = "#0891b2";
const BAR_HOVER = "#22d3ee";

export default function WeeklyBars({ weeks }: { weeks: WeekDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 210;
  const PAD_X = 16;
  const PAD_TOP = 26;
  const PAD_BOTTOM = 34;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(1, ...weeks.map((w) => w.closed));
  const slot = (W - PAD_X * 2) / weeks.length;
  const barW = Math.min(44, slot * 0.55);

  const maxIdx = weeks.reduce(
    (best, w, i) => (w.closed > weeks[best].closed ? i : best),
    0
  );

  const roundedTopBar = (x: number, y: number, w: number, h: number) => {
    const r = Math.min(4, h);
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  };

  return (
    <div className="relative" dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="مهام أقفلتها الأتمتة أسبوعيًا"
      >
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_TOP + plotH * (1 - f)}
            y2={PAD_TOP + plotH * (1 - f)}
            stroke="var(--line-soft)"
            strokeWidth="1"
          />
        ))}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={PAD_TOP + plotH}
          y2={PAD_TOP + plotH}
          stroke="var(--line)"
          strokeWidth="1.5"
        />

        {weeks.map((w, i) => {
          const h = Math.max(w.closed > 0 ? 6 : 2, (w.closed / max) * plotH);
          const x = PAD_X + slot * i + (slot - barW) / 2;
          const y = PAD_TOP + plotH - h;
          const showLabel = i === maxIdx || i === weeks.length - 1 || hover === i;
          return (
            <g
              key={w.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "default" }}
            >
              <rect
                x={PAD_X + slot * i}
                y={PAD_TOP - 10}
                width={slot}
                height={plotH + 14}
                fill="transparent"
              />
              <path
                d={roundedTopBar(x, y, barW, h)}
                fill={hover === i ? BAR_HOVER : BAR}
                opacity={w.closed === 0 ? 0.35 : 1}
                style={{ transition: "fill 120ms" }}
              />
              {showLabel && w.closed > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 7}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="var(--text)"
                >
                  {w.closed}
                </text>
              )}
              <text
                x={PAD_X + slot * i + slot / 2}
                y={H - 12}
                textAnchor="middle"
                fontSize="10"
                fill={i === weeks.length - 1 ? "var(--text)" : "var(--text-soft)"}
                fontWeight={i === weeks.length - 1 ? 700 : 400}
              >
                {w.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          dir="rtl"
          className="absolute pointer-events-none card px-3 py-2 text-xs -translate-x-1/2"
          style={{
            left: `${((PAD_X + slot * hover + slot / 2) / W) * 100}%`,
            top: 0,
          }}
        >
          <div className="font-bold">{weeks[hover].label}</div>
          <div className="text-slate-300">
            {weeks[hover].closed} مهمة مقفلة
            {weeks[hover].minutes_saved > 0 &&
              ` • وفّرت ~${weeks[hover].minutes_saved} دقيقة`}
          </div>
        </div>
      )}

      <details className="mt-3" dir="rtl">
        <summary className="text-[0.68rem] text-slate-500 cursor-pointer hover:text-slate-300">
          عرض البيانات كجدول
        </summary>
        <table className="w-full text-xs mt-2">
          <thead>
            <tr className="text-slate-500 border-b border-[var(--line-soft)]">
              <th className="text-right py-1 font-medium">الأسبوع</th>
              <th className="text-right py-1 font-medium">مهام مقفلة</th>
              <th className="text-right py-1 font-medium">دقائق موفَّرة</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.label} className="border-b border-[var(--well)]">
                <td className="py-1">{w.label}</td>
                <td className="py-1">{w.closed}</td>
                <td className="py-1">{w.minutes_saved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
