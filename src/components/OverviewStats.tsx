"use client";

// إحصاءات النظرة العامة — بطاقات تفاعلية بأرقام متحركة وحلقة نجاح، كل بطاقة تنقلك لمكانها
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration = 900) {
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
  const r = 20;
  const c = 2 * Math.PI * r;
  const animated = useCountUp(pct);
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="url(#ringGrad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * animated) / 100}
      />
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[kind]}
    </svg>
  );
}

function Num({ value, suffix }: { value: number; suffix?: string }) {
  const v = useCountUp(value);
  const shown = Number.isInteger(value) ? Math.round(v) : Math.round(v * 10) / 10;
  return (
    <span className="text-[1.7rem] font-bold leading-none tabular-nums">
      {shown}
      {suffix && <span className="text-sm font-semibold mr-1">{suffix}</span>}
    </span>
  );
}

const tileCls =
  "card p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(34,211,238,0.10)] hover:border-cyan-400/40 group";

export default function OverviewStats() {
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5 h-[92px] animate-pulse" />
        ))}
      </div>
    );
  }

  const hours = Math.round((totals.minutes_saved / 60) * 10) / 10;
  const rate = totals.runs_total
    ? Math.round((totals.runs_success / totals.runs_total) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      <Link href="/flows" className={tileCls}>
        <span className="w-11 h-11 rounded-xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
          <StatIcon kind="bolt" />
        </span>
        <span>
          <Num value={totals.active} />
          <span className="block text-[0.7rem] text-slate-400 mt-1.5">مسار مفعّل يعمل عنك</span>
        </span>
      </Link>

      <Link href="/progress" className={tileCls}>
        <span className="w-11 h-11 rounded-xl bg-cyan-400/10 text-cyan-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
          <StatIcon kind="check" />
        </span>
        <span>
          <Num value={totals.runs_success} />
          <span className="block text-[0.7rem] text-slate-400 mt-1.5">مهمة أُنجزت تلقائيًا</span>
        </span>
      </Link>

      <Link href="/progress" className={tileCls}>
        <span className="relative shrink-0 group-hover:scale-110 transition-transform">
          <Ring pct={rate} />
          <span className="absolute inset-0 flex items-center justify-center text-[0.68rem] font-bold text-violet-300">
            {rate}%
          </span>
        </span>
        <span>
          <span className="block text-sm font-bold">معدل النجاح</span>
          <span className="block text-[0.7rem] text-slate-400 mt-1.5">
            {totals.runs_total ? `من ${totals.runs_total} تشغيلة` : "بانتظار أول تشغيلة"}
          </span>
        </span>
      </Link>

      <Link href="/progress" className={tileCls}>
        <span className="w-11 h-11 rounded-xl bg-amber-400/10 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
          <StatIcon kind="clock" />
        </span>
        <span>
          <Num value={hours} suffix="ساعة" />
          <span className="block text-[0.7rem] text-slate-400 mt-1.5">رجعت لك من وقتك</span>
        </span>
      </Link>
    </div>
  );
}
