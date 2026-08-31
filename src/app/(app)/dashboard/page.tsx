import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import OverviewStats from "@/components/OverviewStats";
import FlowCard from "@/components/FlowCard";
import type { FlowRow } from "@/lib/types";

export default async function Dashboard() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: flows }, { data: approvals }] = await Promise.all([
    supabase
      .from("flows")
      .select("id, name, status, solution_types, evaluation, updated_at")
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("approvals")
      .select("id, flow_id, summary, action_type, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
      {/* البطاقة الرئيسية: رسالة واحدة واضحة + إجراء واحد */}
      <div className="card relative overflow-hidden p-8 md:p-10 mb-8 border-cyan-400/25">
        <div
          className="pointer-events-none absolute -top-24 -start-24 w-72 h-72 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-28 -end-20 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)" }}
        />
        <div className="relative">
          <h1 className="text-2xl md:text-[1.9rem] font-bold leading-snug mb-2">
            وش المهمة اللي تاخذ من وقتك كل يوم؟
          </h1>
          <p className="text-sm md:text-base text-slate-400 mb-6 max-w-xl leading-relaxed">
            صفها بجملة واحدة — سِمَاط يسألك سؤالًا أو سؤالين بالكثير، ثم يبنيها
            أتمتة تعمل عنك. وكل إرسال حسّاس يبقى بموافقتك.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/chat" className="btn btn-primary text-base px-6 py-3">
              + ابدأ المحادثة
            </Link>
            <Link href="/flows" className="btn btn-ghost">
              مساراتي
            </Link>
          </div>
        </div>
      </div>

      <OverviewStats />

      {(approvals ?? []).length > 0 && (
        <div className="card p-5 mb-8 border-amber-400/40">
          <h2 className="font-bold text-amber-300 mb-3">
            ⏳ بانتظار موافقتك ({approvals!.length})
          </h2>
          <div className="space-y-2">
            {approvals!.map((a) => (
              <Link
                key={a.id}
                href={`/flow/${a.flow_id}?tab=run`}
                className="block text-sm text-slate-300 hover:text-white"
              >
                ← {a.action_type}: {a.summary?.slice(0, 90)}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold">أحدث المسارات</h2>
        <Link href="/flows" className="text-sm text-cyan-300 hover:underline">
          عرض الكل ←
        </Link>
      </div>

      {(flows ?? []).length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <div className="text-4xl mb-4">🪄</div>
          <p className="text-lg text-slate-300 mb-1">لا توجد مسارات بعد</p>
          <p className="text-sm">أول محادثة تاخذ دقيقتين — وبعدها الشغل المكرر علينا.</p>
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
