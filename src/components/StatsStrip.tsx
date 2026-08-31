"use client";

import { useEffect, useState } from "react";

// شريط تقارير اللوحة: النجاح والوقت الموفَّر عبر كل المسارات
export default function StatsStrip() {
  const [totals, setTotals] = useState<{
    active: number;
    runs_success: number;
    runs_total: number;
    minutes_saved: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setTotals(d.totals ?? null))
      .catch(() => {});
  }, []);

  if (!totals || totals.runs_total === 0) return null;

  const hours = Math.round((totals.minutes_saved / 60) * 10) / 10;
  const rate = totals.runs_total
    ? Math.round((totals.runs_success / totals.runs_total) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {[
        [String(totals.active), "مسار مفعّل", "text-emerald-300"],
        [String(totals.runs_success), "تشغيلة ناجحة", "text-cyan-300"],
        [`${rate}%`, "معدل النجاح", "text-violet-300"],
        [`${hours} ساعة`, "وقت موفَّر تقريبي", "text-amber-300"],
      ].map(([value, label, color]) => (
        <div key={label} className="card p-4 text-center">
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-[0.68rem] text-slate-400 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}
