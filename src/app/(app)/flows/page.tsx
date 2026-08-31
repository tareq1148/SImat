import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FlowCard from "@/components/FlowCard";
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
        <div className="card px-8 py-14 text-center">
          <span className="mx-auto mb-5 w-12 h-12 rounded-[14px] bg-[var(--well)] text-[var(--accent)] flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="6" r="2.2" />
              <circle cx="19" cy="6" r="2.2" />
              <circle cx="12" cy="18" r="2.2" />
              <path d="M6.5 7.8 10.6 16M17.5 7.8 13.4 16" />
            </svg>
          </span>
          <p className="font-semibold mb-1.5">لا توجد مسارات بعد</p>
          <p className="text-sm text-[var(--text-soft)] mb-6">
            ابدأ محادثة وصف المهمة التي تستهلك وقتك — والباقي علينا.
          </p>
          <Link href="/chat" className="btn btn-primary">
            ابدأ المحادثة الأولى
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {(flows as FlowRow[]).map((f) => (
            <FlowCard key={f.id} flow={f} />
          ))}
        </div>
      )}
    </main>
  );
}
