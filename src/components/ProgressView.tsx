"use client";

// شاشة الإنجاز: عنوان الأسبوع + مخطط أسبوعي + المستوى + خطة التقدم والتميز

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

export default function ProgressView() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports/progress")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch(() => setErr("تعذر تحميل التقرير"));
  }, []);

  if (err) return <p className="text-red-300">{err}</p>;
  if (!data)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="card h-28" />
        <div className="card h-64" />
        <div className="card h-40" />
      </div>
    );

  const { headline, weeks, level, plan } = data;
  const wowChip =
    headline.wow > 0
      ? {
          text: `📈 أكفأ من الأسبوع الماضي بنسبة ${headline.wow}%`,
          cls: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
        }
      : headline.wow < 0
        ? {
            text: `📉 أهدأ من الأسبوع الماضي بنسبة ${Math.abs(headline.wow)}%`,
            cls: "border-amber-400/40 text-amber-300 bg-amber-400/10",
          }
        : {
            text: "⚖️ نفس وتيرة الأسبوع الماضي",
            cls: "border-slate-400/40 text-slate-300 bg-slate-400/10",
          };

  return (
    <div className="space-y-6">
      <div className="card p-6 text-center relative overflow-hidden">
        <div className="text-sm text-slate-400 mb-2">إنجازك هذا الأسبوع</div>
        <h1 className="text-3xl md:text-4xl font-bold leading-snug mb-3">
          ✨ الأتمتة قفلت لك{" "}
          <span className="bg-gradient-to-l from-cyan-300 to-violet-300 bg-clip-text text-transparent">
            {headline.closed_this_week} {headline.closed_this_week === 1 ? "مهمة" : "مهام"}
          </span>
        </h1>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className={`chip ${wowChip.cls}`}>{wowChip.text}</span>
          {headline.minutes_saved_this_week > 0 && (
            <span className="chip border-violet-400/40 text-violet-300 bg-violet-400/10">
              ⏱️ وفّرت ~{Math.round((headline.minutes_saved_this_week / 60) * 10) / 10} ساعة
            </span>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-bold mb-1">مهام أقفلتها الأتمتة أسبوعيًا</h2>
        <p className="text-xs text-slate-400 mb-4">آخر ستة أسابيع — مرّر فوق أي عمود للتفاصيل.</p>
        <WeeklyBars weeks={weeks} />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-bold">🏅 مستواك: {level.name}</h2>
          <span className="text-xs text-slate-400">
            {level.total_closed} مهمة مقفلة إجمالًا
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-[var(--line-soft)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-l from-cyan-400 to-violet-400 transition-all duration-700"
            style={{ width: `${level.progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {level.next
            ? `باقي ${level.next.remaining} ${level.next.remaining === 1 ? "مهمة" : "مهام"} لتصير «${level.next.name}» 💪`
            : "وصلت أعلى مستوى — أنت مرجع الأتمتة هنا 👑"}
        </p>
      </div>

      <div>
        <h2 className="font-bold mb-1">🎯 خطة التقدم والتميز</h2>
        <p className="text-xs text-slate-400 mb-4">
          مبنية من بياناتك الفعلية هذا الأسبوع — رتبناها بالأثر الأكبر أولًا.
        </p>
        <div className="space-y-3">
          {plan.map((p, i) => (
            <div key={i} className="card p-4 flex items-start gap-4">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-[var(--well)] border border-[var(--line)] flex items-center justify-center text-lg">
                {p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm mb-0.5">
                  {i + 1}. {p.title}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{p.why}</p>
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
