// إدارة الإصدارات (PRD 10.10): كل تعديل = إصدار جديد، والقديم محفوظ للاسترجاع

import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateSpec } from "./scoring";
import { buildIR } from "./ir";
import type { Evaluation, TaskSpec } from "./types";

export async function publishNewVersion(
  supabase: SupabaseClient,
  flow: { id: string; task_spec_id: string | null; current_version: number },
  spec: TaskSpec,
  note: string
): Promise<{ version: number; evaluation: Evaluation }> {
  const evaluation = evaluateSpec(spec);
  const version = (flow.current_version ?? 0) + 1;

  if (flow.task_spec_id) {
    await supabase
      .from("task_specs")
      .update({
        title: spec.title,
        goal: spec.goal,
        trigger_description: spec.trigger.description,
        inputs: spec.inputs,
        outputs: spec.outputs,
        steps: spec.steps,
        rules: spec.rules,
        exceptions: spec.exceptions,
        acceptance_criteria: spec.acceptance_criteria,
        full_spec: spec,
      })
      .eq("id", flow.task_spec_id);
  }

  const ir = evaluation.suitable ? buildIR(spec, flow.id) : null;
  if (ir) {
    await supabase.from("flow_versions").insert({
      flow_id: flow.id,
      version,
      ir,
      spec,
      note: note.slice(0, 500),
    });
  }

  await supabase
    .from("flows")
    .update({
      name: spec.title,
      solution_types: evaluation.solution_types,
      evaluation,
      status: evaluation.suitable ? "Draft" : "NotSuitable",
      current_version: version,
    })
    .eq("id", flow.id);

  return { version, evaluation };
}
