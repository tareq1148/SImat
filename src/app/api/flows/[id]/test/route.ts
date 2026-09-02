import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { callFlowWebhook, friendlyWebhookError, isInactiveWebhook } from "@/lib/n8n";
import type { TaskSpec, WorkflowIR } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { input?: unknown };

  const { data: flow } = await supabase
    .from("flows")
    .select("*, task_specs(full_spec)")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });
  if (!flow.n8n_workflow_id)
    return Response.json({ error: "ابنِ سير العمل أولًا" }, { status: 400 });

  const { data: versionRow } = await supabase
    .from("flow_versions")
    .select("ir")
    .eq("flow_id", id)
    .eq("version", flow.current_version)
    .single();
  const ir = versionRow?.ir as WorkflowIR | undefined;
  if (!ir) return Response.json({ error: "لا يوجد إصدار" }, { status: 400 });

  const spec = (flow.task_specs as { full_spec: TaskSpec | null } | null)
    ?.full_spec;
  const expected = spec?.acceptance_criteria ?? [];
  const input =
    body.input ??
    (spec?.test_sample ? { sample: spec.test_sample } : { sample: "بيانات تجريبية" });

  const { data: testRun, error } = await supabase
    .from("test_runs")
    .insert({
      flow_id: id,
      version: flow.current_version,
      input,
      expected,
    })
    .select("id")
    .single();
  if (error || !testRun)
    return Response.json({ error: "تعذر إنشاء تشغيل الاختبار" }, { status: 500 });

  // المسار المفعّل يبقى مفعّلًا أثناء اختباره. لو كُتبت «Testing» فوقه لصار
  // مفتاح الشريط يقول «تشغيل» بينما مؤقّته يعمل في المحرك — والمفتاح يجب
  // أن يصف الحقيقة لا أن يخالفها.
  if (flow.status !== "Active") {
    await supabase.from("flows").update({ status: "Testing" }).eq("id", id);
  }

  const hook = await callFlowWebhook(ir.webhookPath, {
    run_token: `test:${testRun.id}`,
    test_mode: true,
    input,
  });

  if (!hook.ok) {
    const friendly = friendlyWebhookError(hook.status, hook.text);
    await supabase
      .from("test_runs")
      .update({ passed: false, error: friendly })
      .eq("id", testRun.id);
    // الحالة صارت Testing قبل النداء؛ فشلُه يجب أن يُخرجها منها وإلا بقي
    // المسار «قيد الاختبار» أبدًا وظلّ الزرّ يدور بلا نهاية.
    // عدم التفعيل نقصُ معلومات وليس عطلًا — يعود لما قبل الاختبار لا لحالة إصلاح.
    await supabase
      .from("flows")
      .update({
        status: isInactiveWebhook(hook.status, hook.text)
          ? "ReadyToTest"
          : "NeedsRepair",
      })
      .eq("id", id);
    return Response.json(
      { error: friendly, detail: hook.text.slice(0, 300) },
      { status: 502 }
    );
  }

  return Response.json({ testRunId: testRun.id, status: "Testing" });
}
