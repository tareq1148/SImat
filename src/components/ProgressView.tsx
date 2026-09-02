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
  "محترف وَتيرة": "Wateera Pro",
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

/* ===== سلامة التشغيل: نسبة واحدة + الأعطال مشروحة بلغة صاحب المهمة ===== */

function HealthCard({ health }: { health: ProgressData["health"] }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const { score, runs, needs_attention: attention, incidents } = health;

  // أخضر فوق 95، كهرماني 80-95، أحمر تحت 80 — العتبات نفسها لنقطة الحالة والحلقة
  const tone =
    score >= 95 ? "var(--ok)" : score >= 80 ? "var(--warn)" : "var(--bad)";
  const clean = incidents.length === 0 && attention.length === 0;

  return (
    <div className="card p-6 rise-1">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
        <div>
          <h2 className="font-semibold text-[0.95rem]">
            {ar ? "سلامة التشغيل" : "System health"}
          </h2>
          <p className="text-[0.76rem] text-[var(--text-soft)] mt-1">
            {runs.settled === 0
              ? ar
                ? "لا توجد تشغيلات محسومة بعد"
                : "No settled runs yet"
              : ar
                ? `${runs.ok} من ${runs.settled} تشغيلة نجحت خلال ٣٠ يومًا`
                : `${runs.ok} of ${runs.settled} runs succeeded in 30 days`}
          </p>
        </div>

        {/* حلقة النسبة */}
        <div className="relative shrink-0 w-[74px] h-[74px]">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--line)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke={tone}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 97.4} 97.4`}
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-[1.05rem] font-bold tabular-nums"
            style={{ color: tone }}
          >
            {score}%
          </span>
        </div>
      </div>

      {clean ? (
        <p className="text-[0.82rem] text-[var(--text-soft)] flex items-center gap-2">
          <span className="status-dot" style={{ background: "var(--ok)" }} />
          {ar
            ? "كل مساراتك سليمة — لا أعطال مسجّلة."
            : "All flows are healthy — no incidents recorded."}
        </p>
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => (
            <div
              key={inc.run_id}
              className="rounded-xl border p-3.5"
              style={{
                borderColor:
                  inc.severity === "transient" ? "var(--line)" : "var(--accent-bg)",
                background: "var(--well)",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="status-dot shrink-0"
                  style={{
                    background:
                      inc.severity === "transient" ? "var(--warn)" : "var(--bad)",
                  }}
                />
                <span className="text-[0.78rem] font-semibold">{inc.flow_name}</span>
                <span className="text-[0.66rem] text-[var(--text-soft)]">
                  {new Date(inc.at).toLocaleDateString(ar ? "ar-SA" : "en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
                {inc.severity === "transient" && (
                  <span className="chip text-[0.62rem] py-0.5">
                    {ar ? "عارض" : "Transient"}
                  </span>
                )}
              </div>
              <p className="text-[0.8rem] leading-relaxed text-[var(--text)] mb-2.5">
                {ar ? inc.message : inc.message_en}
              </p>
              <Link
                href={inc.href}
                className="btn btn-primary text-[0.72rem] py-1.5 px-3.5"
              >
                {inc.action_label}
              </Link>
            </div>
          ))}

          {attention.length > 0 && (
            <p className="text-[0.75rem] text-[var(--text-soft)] pt-1">
              {ar
                ? `${attention.length} مسار يحتاج انتباهك: `
                : `${attention.length} flow(s) need attention: `}
              {attention.map((f, i) => (
                <span key={f.id}>
                  {i > 0 && "، "}
                  <Link href={`/flow/${f.id}`} className="text-[var(--accent)]">
                    {f.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
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

  const { headline, weeks, level, plan, health } = data;
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

      <HealthCard health={health} />

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

      {/* أفكار جاهزة — تبدأ محادثة بالنص مباشرة */}
      <div className="rise-3">
        <h2 className="font-semibold text-[0.95rem] mb-1">{t("prog.ideas")}</h2>
        <p className="text-xs text-[var(--text-soft)] mb-3">{t("prog.ideasSub")}</p>
        <div className="flex gap-2 flex-wrap">
          {(lang === "ar"
            ? [
                "سجّل طلبات العملاء من الإيميل في جدول ورد عليهم بتأكيد",
                "أرسل لي على بريدي ملخص رسائل تيليجرام كل مساء",
                "انشر صورة اليوم على إنستقرام بكابشن جاهز",
                "لخّص اجتماعات الأسبوع وأرسلها للفريق على Slack",
              ]
            : [
                "Log email orders into a sheet and send confirmations",
                "Email me a summary of Telegram messages every evening",
                "Post today's photo to Instagram with a ready caption",
                "Summarize this week's meetings and send them to Slack",
              ]
          ).map((idea) => (
            <Link
              key={idea}
              href={`/chat?q=${encodeURIComponent(idea)}`}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[0.78rem] text-[var(--text-soft)] hover:text-[var(--accent)] hover:border-[var(--accent-bg)] transition-colors"
            >
              {idea}
            </Link>
          ))}
        </div>
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
