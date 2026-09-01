import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getExecution, hasN8nKey, listExecutions } from "@/lib/n8n";

// شبكة أمان حتمية: مطابقة حالة الاختبارات/التشغيلات العالقة مع حالة التنفيذ الفعلية في المحرك.
//
// لا تعتمد على تبليغات المحرك: أثناء التطوير المحلي تذهب التبليغات إلى APP_BASE_URL
// (نسخة منشورة) لا إلى الجهاز، فتبقى التجربة معلّقة إلى الأبد رغم نجاحها في المحرك.
// لذلك نبحث هنا عن التنفيذ بأنفسنا ونحسم النجاح كما الفشل.

// هامش يسبق إنشاء الصف: التنفيذ قد يبدأ قبل أن تُسجَّل الطابعة الزمنية بثوانٍ
const MATCH_TOLERANCE_MS = 15_000;

/** أقدم تنفيذ بدأ بعد لحظة إنشاء الصف — هو تنفيذ هذه التجربة */
function matchExecution(
  executions: { id: string; status: string; startedAt: string | null }[],
  createdAt: string
): string | null {
  const floor = new Date(createdAt).getTime() - MATCH_TOLERANCE_MS;
  const after = executions
    .filter((e) => e.startedAt && new Date(e.startedAt).getTime() >= floor)
    .sort(
      (a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime()
    );
  return after[0]?.id ?? null;
}

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

  const { data: flow } = await supabase
    .from("flows")
    .select("n8n_workflow_id")
    .eq("id", id)
    .single();
  const workflowId = flow?.n8n_workflow_id as string | null;

  let reconciled = 0;

  // تنفيذات المحرك لهذا المسار — تُجلب مرة واحدة وتُستخدم لكل الصفوف المعلّقة
  let executions: { id: string; status: string; startedAt: string | null }[] = [];
  if (workflowId) {
    try {
      executions = await listExecutions(workflowId, 20);
    } catch {
      // المحرك غير متاح — نكمل بما لدينا
    }
  }

  // ===== التجارب =====
  const { data: pendingTests } = await supabase
    .from("test_runs")
    .select("id, n8n_execution_id, created_at")
    .eq("flow_id", id)
    .is("passed", null)
    .limit(5);

  for (const t of pendingTests ?? []) {
    // معرّف التنفيذ مفقود (ضاع تبليغ البدء) — نطابقه بالوقت
    let execId = t.n8n_execution_id as string | null;
    if (!execId) {
      execId = matchExecution(executions, t.created_at as string);
      if (execId) {
        await supabase
          .from("test_runs")
          .update({ n8n_execution_id: execId })
          .eq("id", t.id);
      }
    }
    if (!execId) continue;

    try {
      const exec = await getExecution(execId);
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
      } else if (exec.status === "success" && exec.finished) {
        // النجاح كان يُحسم بالتبليغ وحده — نحسمه هنا أيضًا
        await supabase
          .from("test_runs")
          .update({ passed: true, error: null })
          .eq("id", t.id);
        await supabase
          .from("flows")
          .update({ status: "Ready", repair_attempts: 0 })
          .eq("id", id);
        reconciled++;
      }
    } catch {
      // المحرك غير متاح مؤقتًا — سنحاول في الاستطلاع التالي
    }
  }

  // ===== التشغيلات الفعلية =====
  const { data: pendingRuns } = await supabase
    .from("runs")
    .select("id, n8n_execution_id, started_at")
    .eq("flow_id", id)
    .eq("status", "running")
    .limit(5);

  for (const r of pendingRuns ?? []) {
    let execId = r.n8n_execution_id as string | null;
    if (!execId) {
      execId = matchExecution(executions, r.started_at as string);
      if (execId) {
        await supabase
          .from("runs")
          .update({ n8n_execution_id: execId })
          .eq("id", r.id);
      }
    }
    if (!execId) continue;

    try {
      const exec = await getExecution(execId);
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
      } else if (exec.status === "success" && exec.finished) {
        await supabase
          .from("runs")
          .update({ status: "success", finished_at: new Date().toISOString() })
          .eq("id", r.id);
        reconciled++;
      }
    } catch {
      // تجاهل مؤقت
    }
  }

  return Response.json({ reconciled });
}
