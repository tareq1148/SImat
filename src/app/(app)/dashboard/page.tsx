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
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-9">
      {/* ترويسة الصفحة: رسالة واحدة واضحة وإجراء واحد */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-[1.55rem] font-bold mb-1.5">نظرة عامة</h1>
          <p className="text-sm text-[var(--text-soft)] max-w-lg leading-relaxed">
            صف مهمتك المتكررة بجملة واحدة — يسألك سِمَاط سؤالًا أو سؤالين، ثم
            يبنيها أتمتة تعمل عنك بموافقتك على كل إجراء حساس.
          </p>
        </div>
        <Link href="/chat" className="btn btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          محادثة جديدة
        </Link>
      </div>

      <OverviewStats />

      {(approvals ?? []).length > 0 && (
        <div className="card p-5 mb-8" style={{ borderColor: "color-mix(in srgb, var(--warn) 40%, transparent)" }}>
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="status-dot" style={{ background: "var(--warn)" }} />
            بانتظار موافقتك ({approvals!.length})
          </h2>
          <div className="space-y-2">
            {approvals!.map((a) => (
              <Link
                key={a.id}
                href={`/flow/${a.flow_id}?tab=run`}
                className="block text-sm text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
              >
                ← {a.action_type}: {a.summary?.slice(0, 90)}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[0.95rem]">أحدث المسارات</h2>
        <Link
          href="/flows"
          className="text-[0.8rem] font-medium text-[var(--accent)] hover:underline"
        >
          عرض الكل ←
        </Link>
      </div>

      {(flows ?? []).length === 0 ? (
        <div className="card px-8 py-14 text-center">
          <span className="mx-auto mb-5 w-12 h-12 rounded-[14px] bg-[var(--well)] text-[var(--accent)] flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
            </svg>
          </span>
          <p className="font-semibold mb-1.5">لا توجد مسارات بعد</p>
          <p className="text-sm text-[var(--text-soft)] mb-6">
            أول محادثة تستغرق دقيقتين — وبعدها العمل المتكرر علينا.
          </p>
          <Link href="/chat" className="btn btn-primary">
            ابدأ المحادثة الأولى
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3.5">
          {(flows as FlowRow[]).map((f) => (
            <FlowCard key={f.id} flow={f} />
          ))}
        </div>
      )}
    </main>
  );
}
