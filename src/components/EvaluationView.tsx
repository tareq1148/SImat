import type { Evaluation } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  deterministic: "سير عمل ثابت",
  ai_assisted: "مدعوم بالذكاء الاصطناعي",
  agentic: "وكيلي (ضمن حدود)",
  human_in_loop: "موافقة بشرية",
};

export default function EvaluationView({ ev }: { ev: Evaluation }) {
  return (
    <div className="space-y-6">
      <div className="card p-6 flex items-center gap-6">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line-soft)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={ev.suitable ? "#34d399" : "#f87171"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(ev.score / 100) * 264} 264`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{ev.score}</span>
            <span className="text-[0.6rem] text-slate-400">من 100</span>
          </div>
        </div>
        <div>
          <div
            className={`text-lg font-bold mb-1 ${ev.suitable ? "text-emerald-300" : "text-red-300"}`}
          >
            {ev.suitable ? "✓ مناسبة للأتمتة" : "✗ غير مناسبة حاليًا"}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{ev.explanation}</p>
          {ev.solution_types.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {ev.solution_types.map((t) => (
                <span key={t} className="chip border-violet-400/40 text-violet-300 bg-violet-400/10">
                  {TYPE_LABELS[t]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold mb-4 text-sm text-slate-300">البوابات الإلزامية</h3>
          <div className="space-y-3">
            {ev.gates.map((g) => (
              <div key={g.key} className="flex gap-3 items-start">
                <span className={g.passed ? "text-emerald-400" : "text-red-400"}>
                  {g.passed ? "✓" : "✗"}
                </span>
                <div>
                  <div className="text-sm font-semibold">{g.label}</div>
                  <div className="text-xs text-slate-400 leading-relaxed">{g.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold mb-4 text-sm text-slate-300">
            عوامل التقييم — لماذا هذه الدرجة؟
          </h3>
          <div className="space-y-3">
            {ev.factors.map((f) => (
              <div key={f.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">{f.label}</span>
                  <span className="text-slate-400">
                    {f.score}/{f.max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--line-soft)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-cyan-400 to-violet-400"
                    style={{ width: `${(f.score / f.max) * 100}%` }}
                  />
                </div>
                <div className="text-[0.68rem] text-slate-500 mt-1 leading-relaxed">
                  {f.reason}
                </div>
              </div>
            ))}
            {ev.factors.length === 0 && (
              <p className="text-xs text-slate-500">لم تُحسب العوامل — البوابات لم تُجتز.</p>
            )}
          </div>
        </div>
      </div>

      {ev.missing_info.length > 0 && (
        <div className="card p-5 border-amber-400/40">
          <h3 className="font-bold mb-3 text-sm text-amber-300">معلومات ناقصة تحسّن النتيجة</h3>
          <ul className="space-y-1.5 text-sm text-slate-300 list-disc pr-5">
            {ev.missing_info.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
