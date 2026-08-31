"use client";

// شاشة الإنجاز — «وش صار» كمخطط معماري بلغة لوحة الرسم: مهامك ← سِمَاط ← النتائج

import { useEffect, useState } from "react";
import Link from "next/link";
import WeeklyBars, { type WeekDatum } from "./WeeklyBars";

interface ProgressData {
  headline: {
    closed_this_week: number;
    minutes_saved_this_week: number;
    wow: number;
    last_week_closed: number;
  };
  weeks: (WeekDatum & { failed: number })[];
  level: {
    name: string;
    total_closed: number;
    next: { name: string; at: number; remaining: number } | null;
    progress: number;
  };
  plan: { icon: string; title: string; why: string; cta: { label: string; href: string } }[];
}

/* ===== المخطط المعماري: نفس لغة عقد لوحة الرسم ===== */

function NodeIcon({ kind, size = 30 }: { kind: string; size?: number }) {
  const glyphs: Record<string, React.ReactNode> = {
    tasks: <path d="M4 5h16v14H4zM4 13h5l1.5 2h3L15 13h5" />,
    engine: (
      <>
        <circle cx="7" cy="7" r="2" />
        <circle cx="17" cy="7" r="2" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
        <circle cx="12" cy="12" r="2.2" />
        <path d="M8.5 8.5 10.4 10.4M15.5 8.5 13.6 10.4M8.5 15.5l1.9-1.9M15.5 15.5 13.6 13.6" />
      </>
    ),
    done: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 5-5.5" />
      </>
    ),
    time: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    active: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />,
  };
  return (
    <svg
      width={size * 0.55}
      height={size * 0.55}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyphs[kind]}
    </svg>
  );
}

function DiagramNode({
  kind,
  category,
  label,
  value,
  style,
  engine,
}: {
  kind: string;
  category: string;
  label: string;
  value?: string;
  style: React.CSSProperties;
  engine?: boolean;
}) {
  return (
    <div
      dir="rtl"
      className="absolute bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3.5 py-3 flex items-center gap-2.5"
      style={{
        ...style,
        boxShadow: engine
          ? "0 0 26px rgba(34,211,238,0.28), var(--card-shadow)"
          : "var(--card-shadow)",
        borderColor: engine ? "color-mix(in srgb, var(--accent-bg) 55%, var(--line))" : undefined,
      }}
    >
      <span
        className="shrink-0 rounded-[9px] flex items-center justify-center"
        style={{
          width: engine ? 34 : 30,
          height: engine ? 34 : 30,
          background: "var(--accent-bg)",
        }}
      >
        <NodeIcon kind={kind} size={engine ? 34 : 30} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          dir="ltr"
          className="block text-[0.55rem] font-semibold tracking-[0.08em] text-[var(--text-soft)] leading-none mb-1 text-right"
        >
          {category}
        </span>
        <span className="block text-[0.78rem] font-semibold leading-tight whitespace-nowrap">
          {label}
        </span>
      </span>
      {value !== undefined && (
        <span className="text-[1.25rem] font-bold tabular-nums text-[var(--accent)] shrink-0">
          {value}
        </span>
      )}
    </div>
  );
}

function ArchDiagram({
  closed,
  hours,
  active,
}: {
  closed: number;
  hours: number;
  active: number;
}) {
  // إحداثيات ثابتة داخل حاوية 640×250 قابلة للتمرير على الجوال
  const edges = [
    { d: "M 482 125 C 452 125, 425 125, 397 125" },
    { d: "M 247 125 C 222 125, 222 38, 198 38" },
    { d: "M 247 125 C 230 125, 215 125, 198 125" },
    { d: "M 247 125 C 222 125, 222 212, 198 212" },
  ];
  return (
    <div className="overflow-x-auto">
      <div
        className="relative mx-auto"
        style={{
          width: 640,
          height: 250,
          backgroundImage: "radial-gradient(var(--edge) 1.2px, transparent 1.2px)",
          backgroundSize: "20px 20px",
        }}
      >
        <svg
          className="absolute inset-0"
          width="640"
          height="250"
          viewBox="0 0 640 250"
          fill="none"
        >
          {edges.map((e, i) => (
            <path key={`b${i}`} d={e.d} stroke="var(--edge)" strokeWidth="1.1" opacity="0.55" />
          ))}
          {edges.map((e, i) => (
            <path
              key={`a${i}`}
              className="nn-edge arch-edge"
              d={e.d}
              stroke="var(--accent)"
              strokeWidth="1.6"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </svg>

        <DiagramNode
          kind="tasks"
          category="TASKS"
          label="مهامك المتكررة"
          style={{ right: 4, top: 96, width: 152 }}
        />
        <DiagramNode
          kind="engine"
          category="ENGINE"
          label="سِمَاط"
          engine
          style={{ right: 243, top: 94, width: 152 }}
        />
        <DiagramNode
          kind="done"
          category="DONE"
          label="أُنجزت تلقائيًا"
          value={String(closed)}
          style={{ left: 4, top: 10, width: 194 }}
        />
        <DiagramNode
          kind="time"
          category="TIME"
          label="ساعة موفَّرة"
          value={String(hours)}
          style={{ left: 4, top: 97, width: 194 }}
        />
        <DiagramNode
          kind="active"
          category="ACTIVE"
          label="مسار يعمل عنك"
          value={String(active)}
          style={{ left: 4, top: 184, width: 194 }}
        />
      </div>
    </div>
  );
}

/* ===== الصفحة ===== */

export default function ProgressView() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports/progress")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch(() => setErr("تعذر تحميل التقرير"));
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setActive(d.totals?.active ?? 0))
      .catch(() => {});
  }, []);

  if (err) return <p className="text-red-300">{err}</p>;
  if (!data)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="card h-24" />
        <div className="card h-72" />
        <div className="card h-40" />
      </div>
    );

  const { headline, weeks, level, plan } = data;
  const hours = Math.round((headline.minutes_saved_this_week / 60) * 10) / 10;
  const wowChip =
    headline.wow > 0
      ? {
          text: `أنشط من أمس بنسبة ${headline.wow}%`,
          cls: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
        }
      : headline.wow < 0
        ? {
            text: `أهدأ من أمس بنسبة ${Math.abs(headline.wow)}%`,
            cls: "border-amber-400/40 text-amber-300 bg-amber-400/10",
          }
        : { text: "نفس وتيرة أمس", cls: "chip-neutral" };

  return (
    <div className="space-y-5">
      {/* وش صار — مخطط معماري بنظرة واحدة */}
      <div className="card p-6 rise">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <h1 className="text-[1.35rem] font-bold">
            اليوم: الأتمتة قفلت لك{" "}
            <span className="text-[var(--accent)]">{headline.closed_this_week}</span>{" "}
            {headline.closed_this_week === 1 ? "مهمة" : "مهام"}
          </h1>
          <span className={`chip ${wowChip.cls}`}>{wowChip.text}</span>
        </div>
        <ArchDiagram closed={headline.closed_this_week} hours={hours} active={active} />
      </div>

      <div className="card p-6 rise-1">
        <h2 className="font-semibold text-[0.95rem] mb-4">
          مهام أقفلتها الأتمتة — آخر ٧ أيام
        </h2>
        <WeeklyBars weeks={weeks} />
      </div>

      <div className="card p-5 rise-2">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold text-[0.9rem]">مستواك: {level.name}</h2>
          <span className="text-xs text-[var(--text-soft)]">
            {level.total_closed} مهمة مقفلة إجمالًا
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--line-soft)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${level.progress}%`, background: "var(--accent-bg)" }}
          />
        </div>
        <p className="text-xs text-[var(--text-soft)] mt-2">
          {level.next
            ? `باقي ${level.next.remaining} ${level.next.remaining === 1 ? "مهمة" : "مهام"} لمستوى «${level.next.name}»`
            : "وصلت أعلى مستوى."}
        </p>
      </div>

      <div className="rise-3">
        <h2 className="font-semibold text-[0.95rem] mb-3">خطتك القادمة</h2>
        <div className="space-y-2.5">
          {plan.map((p, i) => (
            <div key={i} className="card p-4 flex items-center gap-3.5">
              <span
                className="w-7 h-7 shrink-0 rounded-full text-[0.78rem] font-bold text-white flex items-center justify-center"
                style={{ background: "var(--accent-bg)" }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[0.85rem] mb-0.5">{p.title}</div>
                <p className="text-xs text-[var(--text-soft)] leading-relaxed">{p.why}</p>
              </div>
              <Link href={p.cta.href} className="btn btn-primary text-xs shrink-0">
                {p.cta.label}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
