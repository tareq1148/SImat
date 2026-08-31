import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { applySpecEdit, diffSpecs } from "@/lib/spec-editor";
import { publishNewVersion } from "@/lib/versioning";
import type { TaskSpec } from "@/lib/types";

export const maxDuration = 300;

// التعديل الآمن (PRD 10.10): تعليمات نصية → إصدار جديد يحافظ على الأجزاء غير المطلوبة
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

  const { instruction } = (await req.json()) as { instruction: string };
  if (!instruction?.trim())
    return Response.json({ error: "اكتب التعديل المطلوب" }, { status: 400 });

  const { data: flow } = await supabase
    .from("flows")
    .select("id, task_spec_id, current_version, task_specs(full_spec)")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });

  const spec = (flow.task_specs as unknown as { full_spec: TaskSpec | null } | null)
    ?.full_spec;
  if (!spec)
    return Response.json({ error: "لا توجد مواصفة لهذا المسار" }, { status: 400 });

  try {
    const edited = await applySpecEdit(spec, instruction.trim());
    const diff = diffSpecs(spec, edited.spec);
    const note = `تعديل: ${edited.summary} — ${diff}`;
    const { version, evaluation } = await publishNewVersion(
      supabase,
      { id: flow.id, task_spec_id: flow.task_spec_id, current_version: flow.current_version },
      edited.spec,
      note
    );
    // تعديل يدوي = صفحة نظيفة لعداد الإصلاح التلقائي
    await supabase.from("flows").update({ repair_attempts: 0 }).eq("id", id);

    return Response.json({
      version,
      note,
      summary: edited.summary,
      diff,
      suitable: evaluation.suitable,
      score: evaluation.score,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "تعذر تطبيق التعديل" },
      { status: 500 }
    );
  }
}
