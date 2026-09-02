"use client";

// شاشة الإنجاز — «وش صار» كمخطط معماري بلغة لوحة الرسم: مهامك ← وَتيرة ← النتائج

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";
import { providerIcon } from "./icons";
import WeeklyBars, { type WeekDatum } from "./WeeklyBars";


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
  health: {
    score: number;
    runs: { ok: number; failed: number; settled: number };
    needs_attention: { id: string; name: string; status: string }[];
    incidents: {
      run_id: string;
      flow_id: string;
      flow_name: string;
      at: string;
      message: string;
      message_en: string;
      action: string;
      action_label: string;
      severity: "blocking" | "transient";
      provider: string | null;
      href: string;
    }[];
  };
}


/* ===== المخطط المعماري: نفس لغة عقد لوحة الرسم ===== */

/** قطر الدائرة — تشترك فيه العقدة وحسابُ مرابط الحواف */
const NODE_H = 52;
/** ارتفاع الاسم تحت الدائرة — يُزاد على ارتفاع اللوحة لئلّا يُقصّ آخر صفّ */
const LABEL_H = 26;

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

// الشكل المعتمد في اللوحة: دائرة فيها شعار الخدمة، واسمها تحتها خارجها
function DiagramNode({
  kind,
  label,
  value,
  style,
  engine,
  brandIcon,
}: {
  kind?: string;
  label: string;
  value?: string;
  style: React.CSSProperties;
  engine?: boolean;
  brandIcon?: React.ReactNode;
}) {
  return (
    <div className="absolute flex flex-col items-center gap-2" style={style}>
      <span
        className="shrink-0 rounded-full bg-[var(--panel-solid)] border flex items-center justify-center"
        style={{
          width: NODE_H,
          height: NODE_H,
          borderColor: engine
            ? "color-mix(in srgb, var(--accent-bg) 55%, var(--line))"
            : "color-mix(in srgb, var(--text) 14%, transparent)",
          boxShadow: engine
            ? "0 0 22px color-mix(in srgb, var(--accent-bg) 30%, transparent), 0 4px 14px rgba(0,0,0,0.1)"
            : "0 4px 14px rgba(0, 0, 0, 0.1)",
        }}
      >
        {brandIcon ?? <NodeIcon kind={kind ?? "tasks"} size={engine ? 26 : 24} />}
      </span>

      <span className="text-center leading-tight">
        <span className="block text-[0.74rem] font-semibold">{label}</span>
        {value !== undefined && (
          <span className="block text-[1.05rem] font-bold tabular-nums text-[var(--accent)]">
            {value}
          </span>
        )}
      </span>
    </div>
  );
}


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
  const slotTop = (count: number, i: number) => {
    const s = H / count;
    return Math.round(i * s + s / 2 - NODE_H / 2);
  };
  const engineTop = Math.round(H / 2 - NODE_H / 2);
  const engineY = engineTop + NODE_H / 2;

  // مراكز الأعمدة داخل حاوية 640 عرضًا (إحداثيات SVG من اليسار)، والحواف
  // ترتبط بمحيط الدائرة لا بحافّة صندوق — فالعقدة صارت دائرة.
  const R = NODE_H / 2;
  const P_CX = 640 - 4 - 150 / 2; // مركز عمود الخدمات
  const E_CX = 640 - 243 - 152 / 2; // مركز عقدة المحرّك
  const R_CX = 4 + 194 / 2; // مركز عمود النتائج
  const P_LEFT = P_CX - R;
  const E_RIGHT = E_CX + R;
  const E_LEFT = E_CX - R;
  const R_RIGHT = R_CX + R;

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
          // الاسم صار تحت الدائرة، فيلزم متّسع أسفل آخر صفٍّ وإلا قُصّ
          height: H + LABEL_H,
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
              label={PROVIDER_LABELS[p]}
              brandIcon={providerIcon(p, 17)}
              style={{ right: 4, top: slotTop(provs.length, i), width: 150 }}
            />
          ))
        ) : (
          <DiagramNode
            kind="tasks"
            label={lang === "ar" ? "اربط حساباتك" : "Connect accounts"}
            style={{ right: 4, top: slotTop(1, 0), width: 150 }}
          />
        )}

        <DiagramNode
          kind="engine"
          label={t("brand")}
          engine
          style={{ right: 243, top: engineTop, width: 152 }}
        />

        {results.map((r, i) => (
          <DiagramNode
            key={r.kind}
            kind={r.kind}
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
  const { t } = useLang();
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

  const { headline, weeks } = data;
  const hours = Math.round((headline.minutes_saved_this_week / 60) * 10) / 10;
  const chartWeeks = weeks.map((w) => ({
    ...w,
    label: w.is_today ? t("prog.today") : (w.date ?? w.label),
  }));

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
    </div>
  );
}
