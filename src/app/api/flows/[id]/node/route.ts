import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { publishNewVersion } from "@/lib/versioning";
import type { TaskSpec } from "@/lib/types";

// الوضع المتقدم: تعديل حقول عقدة يدويًا — حتمي بالكامل، ويُنشر كإصدار جديد
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

  const body = (await req.json()) as {
    nodeId: string;
    params: Record<string, string>;
  };

  const m = /^step-(\d+)$/.exec(body.nodeId ?? "");
  if (!m)
    return Response.json(
      { error: "هذه العقدة نظامية (محفز/موافقة/نتيجة) — الحقول تُعدّل على خطوات المهمة فقط" },
      { status: 400 }
    );
  const stepIdx = Number(m[1]) - 1;

  const { data: flow } = await supabase
    .from("flows")
    .select("id, task_spec_id, current_version, task_specs(full_spec)")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });

  const spec = (flow.task_specs as unknown as { full_spec: TaskSpec | null } | null)
    ?.full_spec;
  if (!spec?.steps?.[stepIdx])
    return Response.json({ error: "الخطوة غير موجودة في المواصفة" }, { status: 400 });

  const clean: Record<string, string> = {};
  Object.entries(body.params ?? {}).forEach(([k, v]) => {
    const key = k.trim();
    if (key && typeof v === "string") clean[key] = v.trim();
  });

  const step = spec.steps[stepIdx];
  const { rule: _oldRule, ...rest } = clean;
  step.params = rest;
  if (clean.rule !== undefined) step.decision_rule = clean.rule || null;

  try {
    const { version, evaluation } = await publishNewVersion(
      supabase,
      { id: flow.id, task_spec_id: flow.task_spec_id, current_version: flow.current_version },
      spec,
      `تعديل يدوي (وضع متقدم): حقول «${step.name}»`
    );
    await supabase.from("flows").update({ repair_attempts: 0 }).eq("id", id);
    return Response.json({ version, suitable: evaluation.suitable, score: evaluation.score });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "تعذر الحفظ" },
      { status: 500 }
    );
  }
}
