import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { callFlowWebhook, friendlyWebhookError } from "@/lib/n8n";
import type { WorkflowIR } from "@/lib/types";

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
    .select("*")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });
  if (flow.status !== "Active")
    return Response.json(
      { error: "فعّل سير العمل أولًا قبل التشغيل الفعلي" },
      { status: 400 }
    );

  const { data: versionRow } = await supabase
    .from("flow_versions")
    .select("ir")
    .eq("flow_id", id)
    .eq("version", flow.current_version)
    .single();
  const ir = versionRow?.ir as WorkflowIR | undefined;
  if (!ir) return Response.json({ error: "لا يوجد إصدار" }, { status: 400 });

  const { data: run, error } = await supabase
    .from("runs")
    .insert({ flow_id: id, version: flow.current_version, status: "running" })
    .select("id")
    .single();
  if (error || !run)
    return Response.json({ error: "تعذر إنشاء التشغيل" }, { status: 500 });

  const hook = await callFlowWebhook(ir.webhookPath, {
    run_token: `run:${run.id}`,
    test_mode: false,
    input: body.input ?? {},
  });

  if (!hook.ok) {
    await supabase
      .from("runs")
      .update({
        status: "error",
        error: friendlyWebhookError(hook.status, hook.text),
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return Response.json({ error: "فشل بدء التشغيل" }, { status: 502 });
  }

  return Response.json({ runId: run.id, status: "running" });
}
