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
            <FlowCard key={f.id} flow={f} />
          ))}
        </div>
      )}
    </main>
  );
}
