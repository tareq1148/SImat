"use client";

// شاشة الإنجاز — «وش صار» كمخطط معماري بلغة لوحة الرسم: مهامك ← وَتيرة ← النتائج

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";
import { providerIcon } from "./icons";
import WeeklyBars, { type WeekDatum } from "./WeeklyBars";

const LEVEL_EN: Record<string, string> = {
  "مبتدئ الأتمتة": "Automation Rookie",
  "مُنجِز": "Achiever",
  "متمكّن": "Proficient",
  "خبير أتمتة": "Automation Expert",
  "محترف وَتيرة": "وَتيرة Pro",
};

interface ProgressData {
  headline: {
    closed_this_week: number;
    minutes_saved_this_week: number;
    wow: number;
    last_week_closed: number;
  };
  weeks: (WeekDatum & { failed: number; date?: string; is_today?: boolean })[];
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
      stroke="currentColor"
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
  brandIcon,
}: {
  kind?: string;
  category: string;
  label: string;
  value?: string;
  style: React.CSSProperties;
  engine?: boolean;
  brandIcon?: React.ReactNode;
}) {
  return (
    <div
      className="absolute bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3.5 py-3 flex items-center gap-2.5"
      style={{
        ...style,
        boxShadow: engine
          ? "0 0 26px rgba(34,211,238,0.28), var(--card-shadow)"
          : "var(--card-shadow)",
        borderColor: engine ? "color-mix(in srgb, var(--accent-bg) 55%, var(--line))" : undefined,
      }}
    >
      {brandIcon ? (
        <span className="shrink-0 w-[30px] h-[30px] rounded-[9px] bg-[var(--well)] border border-[var(--line-soft)] flex items-center justify-center">
          {brandIcon}
        </span>
      ) : (
        <span
          className="mark shrink-0 rounded-[9px] flex items-center justify-center"
          style={{ width: engine ? 34 : 30, height: engine ? 34 : 30 }}
        >
          <NodeIcon kind={kind ?? "tasks"} size={engine ? 34 : 30} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          dir="ltr"
          className="block text-[0.55rem] font-semibold tracking-[0.08em] text-[var(--text-soft)] leading-none mb-1 text-right"
        >
          {category}
        </span>
        <span className="block text-[0.78rem] font-semibold leading-tight whitespace-nowrap truncate">
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

const PROVIDER_CATEGORY: Record<Provider, string> = {
  gmail: "GMAIL",
  google_sheets: "SHEETS",
  google_drive: "DRIVE",
  openai: "AI",
  telegram: "TELEGRAM",
  slack: "SLACK",
  instagram: "INSTAGRAM",
  tiktok: "TIKTOK",
};

function ArchDiagram({
  closed,
  hours,
  active,
  providers,
}: {
  closed: number;
  hours: number;
  active: number;
  providers: Provider[];
}) {
  const { lang, t } = useLang();
  // اليمين: حساباتك المربوطة فعليًا (بأسمائها الحقيقية) ← وَتيرة ← النتائج
  const provs = providers.slice(0, 6);
  const rows = Math.max(provs.length, 3);
  const H = Math.max(250, rows * 84);
  const NODE_H = 56;
  const slotTop = (count: number, i: number) => {
    const s = H / count;
    return Math.round(i * s + s / 2 - NODE_H / 2);
  };
  const engineTop = Math.round(H / 2 - NODE_H / 2);
  const engineY = engineTop + NODE_H / 2;

  // حواف الأعمدة داخل حاوية 640 عرضًا (إحداثيات SVG من اليسار)
  const P_LEFT = 640 - 4 - 150; // حافة عقدة الموقع اليسرى
  const E_RIGHT = 640 - 243; // حافة وَتيرة اليمنى
  const E_LEFT = 640 - 243 - 152;
  const R_RIGHT = 4 + 194;

  const provEdges = (provs.length ? provs : [null]).map((_, i) => {
    const y = slotTop(Math.max(provs.length, 1), i) + NODE_H / 2;
    return `M ${P_LEFT} ${y} C ${P_LEFT - 34} ${y}, ${E_RIGHT + 34} ${engineY}, ${E_RIGHT} ${engineY}`;
  });
  const resultEdges = [0, 1, 2].map((i) => {
    const y = slotTop(3, i) + NODE_H / 2;
    return `M ${E_LEFT} ${engineY} C ${E_LEFT - 26} ${engineY}, ${R_RIGHT + 26} ${y}, ${R_RIGHT} ${y}`;
  });
  const edges = [...provEdges, ...resultEdges];

  const results = [
    { kind: "done", category: "DONE", label: t("diagram.done"), value: String(closed) },
    { kind: "time", category: "TIME", label: t("diagram.time"), value: String(hours) },
    { kind: "active", category: "ACTIVE", label: t("diagram.active"), value: String(active) },
  ];

  return (
    <div className="overflow-x-auto">
      <div
        className="relative mx-auto"
        style={{
          width: 640,
          height: H,
          backgroundImage: "radial-gradient(var(--edge) 1.2px, transparent 1.2px)",
          backgroundSize: "20px 20px",
        }}
      >
        <svg
          className="absolute inset-0"
          width="640"
          height={H}
          viewBox={`0 0 640 ${H}`}
          fill="none"
        >
          {edges.map((d, i) => (
            <path key={`b${i}`} d={d} stroke="var(--edge)" strokeWidth="1.1" opacity="0.55" />
          ))}
          {edges.map((d, i) => (
            <path
              key={`a${i}`}
              className="nn-edge arch-edge"
              d={d}
              stroke="var(--accent)"
              strokeWidth="1.6"
              style={{ animationDelay: `${(i % 5) * 0.22}s` }}
            />
          ))}
        </svg>

        {provs.length > 0 ? (
          provs.map((p, i) => (
            <DiagramNode
              key={p}
              category={PROVIDER_CATEGORY[p]}
              label={PROVIDER_LABELS[p]}
              brandIcon={providerIcon(p, 17)}
              style={{ right: 4, top: slotTop(provs.length, i), width: 150 }}
            />
          ))
        ) : (
          <DiagramNode
            kind="tasks"
            category="CONNECT"
            label={lang === "ar" ? "اربط حساباتك" : "Connect accounts"}
            style={{ right: 4, top: slotTop(1, 0), width: 150 }}
          />
        )}

        <DiagramNode
          kind="engine"
          category="ENGINE"
          label={t("brand")}
          engine
          style={{ right: 243, top: engineTop, width: 152 }}
        />

        {results.map((r, i) => (
          <DiagramNode
            key={r.kind}
            kind={r.kind}
            category={r.category}
            label={r.label}
            value={r.value}
            style={{ left: 4, top: slotTop(3, i), width: 194 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ===== الصفحة ===== */

export default function ProgressView() {
  const { lang, t } = useLang();
  const [data, setData] = useState<ProgressData | null>(null);
  const [active, setActive] = useState(0);
  const [providers, setProviders] = useState<Provider[]>([]);
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
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) =>
        setProviders(
          ((d.connections ?? []) as { provider: Provider }[]).map((c) => c.provider)
        )
      )
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
  const chartWeeks = weeks.map((w) => ({
    ...w,
    label: w.is_today ? t("prog.today") : (w.date ?? w.label),
  }));
  const levelName = lang === "en" ? (LEVEL_EN[level.name] ?? level.name) : level.name;
  const wowChip =
    headline.wow > 0
      ? {
          text:
            lang === "ar"
              ? `أنشط من أمس بنسبة ${headline.wow}%`
              : `${headline.wow}% busier than yesterday`,
          cls: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
        }
      : headline.wow < 0
        ? {
            text:
              lang === "ar"
                ? `أهدأ من أمس بنسبة ${Math.abs(headline.wow)}%`
                : `${Math.abs(headline.wow)}% quieter than yesterday`,
            cls: "border-amber-400/40 text-amber-300 bg-amber-400/10",
          }
        : { text: lang === "ar" ? "نفس وتيرة أمس" : "Same pace as yesterday", cls: "chip-neutral" };

  return (
    <div className="space-y-5">
      {/* وش صار — مخطط معماري بنظرة واحدة */}
      <div className="card p-6 rise">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <h1 className="text-[1.35rem] font-bold">
            {t("prog.headline")}{" "}
            <span className="text-[var(--accent)]">{headline.closed_this_week}</span>{" "}
            {headline.closed_this_week === 1 ? t("prog.task1") : t("prog.taskN")}
          </h1>
          <span className={`chip ${wowChip.cls}`}>{wowChip.text}</span>
        </div>
        <ArchDiagram
          closed={headline.closed_this_week}
          hours={hours}
          active={active}
          providers={providers}
        />
      </div>

      <div className="card p-6 rise-1">
        <h2 className="font-semibold text-[0.95rem] mb-4">{t("prog.chart")}</h2>
        <WeeklyBars weeks={chartWeeks} />
      </div>

      <div className="card p-5 rise-2">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold text-[0.9rem]">
            {t("prog.level")} {levelName}
          </h2>
          <span className="text-xs text-[var(--text-soft)]">
            {level.total_closed} {t("prog.totalClosed")}
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
            ? lang === "ar"
              ? `باقي ${level.next.remaining} ${level.next.remaining === 1 ? "مهمة" : "مهام"} لمستوى «${level.next.name}»`
              : `${level.next.remaining} ${level.next.remaining === 1 ? "task" : "tasks"} to reach “${LEVEL_EN[level.next.name] ?? level.next.name}”`
            : lang === "ar"
              ? "وصلت أعلى مستوى."
              : "You reached the top level."}
        </p>
      </div>

      {plan.length > 0 && (
      <div className="rise-3">
        <h2 className="font-semibold text-[0.95rem] mb-3">{t("prog.plan")}</h2>
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
      )}
    </div>
  );
}
