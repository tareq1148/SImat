"use client";

// إحصاءات النظرة العامة — أرقام متحركة بلون واحد منضبط؛ كل بطاقة تنقلك لمكانها
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function Ring({ pct }: { pct: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const animated = useCountUp(pct);
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="4.5" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="var(--accent-bg)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * animated) / 100}
      />
    </svg>
  );
}

function StatIcon({ kind }: { kind: "bolt" | "check" | "clock" }) {
  const paths = {
    bolt: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />,
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 5-5.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[kind]}
    </svg>
  );
}

function Num({ value, suffix }: { value: number; suffix?: string }) {
  const v = useCountUp(value);
  const shown = Number.isInteger(value) ? Math.round(v) : Math.round(v * 10) / 10;
  return (
    <span className="text-[1.55rem] font-bold leading-none tabular-nums">
      {shown}
      {suffix && (
        <span className="text-[0.78rem] font-semibold text-[var(--text-soft)] mr-1">{suffix}</span>
      )}
    </span>
  );
}

const tileCls =
  "card p-4.5 flex items-center gap-3.5 transition-colors duration-150 hover:border-[var(--accent-bg)] group";

const iconBox =
  "w-10 h-10 rounded-[10px] bg-[var(--well)] text-[var(--accent)] flex items-center justify-center shrink-0";

export default function OverviewStats() {
  const { lang, t } = useLang();
  const [totals, setTotals] = useState<{
    active: number;
    runs_success: number;
    runs_total: number;
    minutes_saved: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setTotals(d.totals ?? { active: 0, runs_success: 0, runs_total: 0, minutes_saved: 0 }))
      .catch(() => setTotals({ active: 0, runs_success: 0, runs_total: 0, minutes_saved: 0 }));
  }, []);

  if (!totals) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4 h-[84px] animate-pulse" />
        ))}
      </div>
    );
  }

  const hours = Math.round((totals.minutes_saved / 60) * 10) / 10;
  const rate = totals.runs_total
    ? Math.round((totals.runs_success / totals.runs_total) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Link href="/flows" className={tileCls}>
        <span className={iconBox}>
          <StatIcon kind="bolt" />
        </span>
        <span>
          <Num value={totals.active} />
          <span className="block text-[0.7rem] text-[var(--text-soft)] mt-1">{t("stats.active")}</span>
        </span>
      </Link>

      <Link href="/progress" className={tileCls}>
        <span className={iconBox}>
          <StatIcon kind="check" />
        </span>
        <span>
          <Num value={totals.runs_success} />
          <span className="block text-[0.7rem] text-[var(--text-soft)] mt-1">{t("stats.done")}</span>
        </span>
      </Link>

      <Link href="/progress" className={tileCls}>
        <span className="relative shrink-0">
          <Ring pct={rate} />
          <span className="absolute inset-0 flex items-center justify-center text-[0.62rem] font-bold tabular-nums">
            {rate}%
          </span>
        </span>
        <span>
          <span className="block text-[0.85rem] font-semibold">{t("stats.rate")}</span>
          <span className="block text-[0.7rem] text-[var(--text-soft)] mt-1">
            {totals.runs_total
              ? lang === "ar"
                ? `من ${totals.runs_total} تشغيلة`
                : `of ${totals.runs_total} runs`
              : t("stats.rateWait")}
          </span>
        </span>
      </Link>

      <Link href="/progress" className={tileCls}>
        <span className={iconBox}>
          <StatIcon kind="clock" />
        </span>
        <span>
          <Num value={hours} suffix={t("stats.hoursUnit")} />
          <span className="block text-[0.7rem] text-[var(--text-soft)] mt-1">{t("stats.hours")}</span>
        </span>
      </Link>
    </div>
  );
}
