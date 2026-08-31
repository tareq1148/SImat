import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { evaluateSpec } from "@/lib/scoring";
import { buildIR } from "@/lib/ir";
import type { TaskSpec } from "@/lib/types";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { specId } = (await req.json()) as { specId: string };
  const { data: specRow } = await supabase
    .from("task_specs")
    .select("*")
    .eq("id", specId)
    .single();
  if (!specRow) return Response.json({ error: "المواصفة غير موجودة" }, { status: 404 });

  const spec = specRow.full_spec as TaskSpec | null;
  if (!spec) {
    return Response.json(
      { error: "المواصفة لم تكتمل بعد — أكمل المقابلة أولًا" },
      { status: 400 }
    );
  }

  const evaluation = evaluateSpec(spec);

  // سير عمل واحد لكل مواصفة (إعادة التقييم تُحدّث ولا تكرر)
  const { data: existing } = await supabase
    .from("flows")
    .select("id, current_version")
    .eq("task_spec_id", specId)
    .maybeSingle();

  const status = evaluation.suitable ? "Draft" : "NotSuitable";
  let flowId: string;
  let version = 1;

  if (existing) {
    flowId = existing.id;
    version = (existing.current_version ?? 0) + 1;
    await supabase
      .from("flows")
      .update({
        name: spec.title,
        solution_types: evaluation.solution_types,
        evaluation,
        status,
        current_version: version,
      })
      .eq("id", flowId);
  } else {
    const { data: created, error } = await supabase
      .from("flows")
      .insert({
        user_id: user.id,
        task_spec_id: specId,
        name: spec.title,
        solution_types: evaluation.solution_types,
        evaluation,
        status,
        current_version: 1,
      })
      .select("id")
      .single();
    if (error || !created)
      return Response.json({ error: "تعذر إنشاء سير العمل" }, { status: 500 });
    flowId = created.id;
  }

  if (evaluation.suitable) {
    const ir = buildIR(spec, flowId);
    await supabase.from("flow_versions").insert({
      flow_id: flowId,
      version,
      ir,
    });
  }

  return Response.json({ flowId, evaluation });
}
