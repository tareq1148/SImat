import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { WorkflowIR } from "@/lib/types";
import { stripApprovals } from "@/lib/ir";

// رسم المسار الحالي — لعرضه في شاشة «سير العمل»
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { data: flow } = await supabase
    .from("flows")
    .select("id, name, status, current_version")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "غير موجود" }, { status: 404 });

  const { data: versionRow } = await supabase
    .from("flow_versions")
    .select("ir")
    .eq("flow_id", id)
    .eq("version", flow.current_version)
    .maybeSingle();

  // نتيجة آخر اختبار ترافق الرسم: اللوحة تستطلع هذا المسار أصلًا،
  // فبلا هذا يبقى المستخدم بلا خبر إن نجح الاختبار أم فشل ولماذا.
  const { data: lastTest } = await supabase
    .from("test_runs")
    .select("passed, error, created_at")
    .eq("flow_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({
    last_test: lastTest ?? null,
    id: flow.id,
    name: flow.name,
    status: flow.status,
    ir: versionRow?.ir ? stripApprovals(versionRow.ir as WorkflowIR) : null,
  });
}
