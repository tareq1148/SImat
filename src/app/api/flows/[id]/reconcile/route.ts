import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getExecution, hasN8nKey } from "@/lib/n8n";

// شبكة أمان حتمية: مطابقة حالة الاختبارات/التشغيلات العالقة مع حالة التنفيذ الفعلية في المحرك
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });
  if (!hasN8nKey()) return Response.json({ reconciled: 0 });

  let reconciled = 0;

  const { data: pendingTests } = await supabase
    .from("test_runs")
    .select("id, n8n_execution_id")
    .eq("flow_id", id)
    .is("passed", null)
    .not("n8n_execution_id", "is", null)
    .limit(5);

  for (const t of pendingTests ?? []) {
    try {
      const exec = await getExecution(t.n8n_execution_id as string);
      if (exec.status === "error" || exec.status === "crashed") {
        await supabase
          .from("test_runs")
          .update({
            passed: false,
            failure_node: exec.errorNode,
            error: `فشل عند العقدة «${exec.errorNode ?? "غير معروفة"}»: ${exec.errorMessage ?? ""}`.slice(0, 500),
          })
          .eq("id", t.id);
        await supabase.from("flows").update({ status: "NeedsRepair" }).eq("id", id);
        reconciled++;
      }
    } catch {
      // المحرك غير متاح مؤقتًا — سنحاول في الاستطلاع التالي
    }
  }

  const { data: pendingRuns } = await supabase
    .from("runs")
    .select("id, n8n_execution_id")
    .eq("flow_id", id)
    .eq("status", "running")
    .not("n8n_execution_id", "is", null)
    .limit(5);

  for (const r of pendingRuns ?? []) {
    try {
      const exec = await getExecution(r.n8n_execution_id as string);
      if (exec.status === "error" || exec.status === "crashed") {
        await supabase
          .from("runs")
          .update({
            status: "error",
            error: `فشل عند العقدة «${exec.errorNode ?? "غير معروفة"}»: ${exec.errorMessage ?? ""}`.slice(0, 500),
            finished_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        reconciled++;
      }
    } catch {
      // تجاهل مؤقت
    }
  }

  return Response.json({ reconciled });
}
