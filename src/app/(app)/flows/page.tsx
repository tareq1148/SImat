import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import StatusChip from "@/components/StatusChip";
import type { FlowRow } from "@/lib/types";

export default async function FlowsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: flows } = await supabase
    .from("flows")
    .select("id, name, status, solution_types, evaluation, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">مسارات العمل</h1>
          <p className="text-sm text-slate-400">
            كل مهمة حوّلتها — بحالتها الحقيقية في محرك التنفيذ.
          </p>
        </div>
        <Link href="/chat" className="btn btn-primary">
          + ابدأ المحادثة
        </Link>
      </div>

      {(flows ?? []).length === 0 ? (
        <div className="card p-14 text-center text-slate-400">
          <div className="text-4xl mb-4">🪄</div>
          <p className="mb-2 text-lg text-slate-300">لا توجد مسارات بعد</p>
          <p className="text-sm mb-6">
            ابدأ محادثة وصف المهمة التي تستهلك وقتك — والباقي علينا.
          </p>
          <Link href="/chat" className="btn btn-primary">
            ابدأ المحادثة الأولى
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(flows as FlowRow[]).map((f) => (
            <Link
              key={f.id}
              href={`/flow/${f.id}`}
              className="card p-5 hover:border-cyan-400/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-bold leading-snug">{f.name}</h3>
                <StatusChip status={f.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {f.evaluation && (
                  <span className="chip border-slate-500/40 text-slate-300 bg-slate-500/10">
                    الجدوى {f.evaluation.score}/100
                  </span>
                )}
                {(f.solution_types ?? []).map((t) => (
                  <span
                    key={t}
                    className="chip border-violet-400/30 text-violet-300 bg-violet-400/5"
                  >
                    {t === "deterministic"
                      ? "ثابت"
                      : t === "ai_assisted"
                        ? "ذكاء اصطناعي"
                        : t === "agentic"
                          ? "وكيلي"
                          : "موافقة بشرية"}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
