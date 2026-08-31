import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { applySpecEdit, diffSpecs } from "@/lib/spec-editor";
import { publishNewVersion } from "@/lib/versioning";
import type { TaskSpec } from "@/lib/types";

export const maxDuration = 300;

// حد محاولات الإصلاح التلقائي (سؤال الـ PRD المفتوح — قرارنا: 2 لكل سلسلة أعطال)
const MAX_REPAIR_ATTEMPTS = 2;

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

  const { data: flow } = await supabase
    .from("flows")
    .select("id, task_spec_id, current_version, repair_attempts, task_specs(full_spec)")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });

  if ((flow.repair_attempts ?? 0) >= MAX_REPAIR_ATTEMPTS) {
    return Response.json(
      {
        error: `وصلنا حد محاولات الإصلاح التلقائي (${MAX_REPAIR_ATTEMPTS}). عدّل المسار بنفسك من «طلب تعديل» أو راجع المواصفة.`,
        exhausted: true,
      },
      { status: 400 }
    );
  }

  const { data: failedTest } = await supabase
    .from("test_runs")
    .select("failure_node, error, input")
    .eq("flow_id", id)
    .eq("passed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!failedTest?.error)
    return Response.json({ error: "لا يوجد فشل مسجل لإصلاحه" }, { status: 400 });

  const spec = (flow.task_specs as unknown as { full_spec: TaskSpec | null } | null)
    ?.full_spec;
  if (!spec)
    return Response.json({ error: "لا توجد مواصفة" }, { status: 400 });

  const instruction =
    `فشل تنفيذ هذا المسار في الاختبار.\n` +
    `العقدة الفاشلة: ${failedTest.failure_node ?? "غير معروفة"}\n` +
    `رسالة الخطأ: ${failedTest.error}\n` +
    `مدخل الاختبار: ${JSON.stringify(failedTest.input ?? {})}\n\n` +
    `أصلح سبب الفشل بأبسط تعديل ممكن على الخطوة المسؤولة فقط (معاملاتها أو وصفها أو أداتها)، ولا تغيّر أي شيء آخر.`;

  try {
    const edited = await applySpecEdit(spec, instruction);
    const diff = diffSpecs(spec, edited.spec);
    const attempt = (flow.repair_attempts ?? 0) + 1;
    const note = `إصلاح تلقائي ${attempt}/${MAX_REPAIR_ATTEMPTS}: ${edited.summary} — ${diff}`;
    const { version } = await publishNewVersion(
      supabase,
      { id: flow.id, task_spec_id: flow.task_spec_id, current_version: flow.current_version },
      edited.spec,
      note
    );
    await supabase
      .from("flows")
      .update({ repair_attempts: attempt })
      .eq("id", id);

    return Response.json({
      version,
      note,
      summary: edited.summary,
      attempt,
      remaining: MAX_REPAIR_ATTEMPTS - attempt,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "تعذر الإصلاح التلقائي" },
      { status: 500 }
    );
  }
}
