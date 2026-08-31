// التعديل الآمن (PRD 10.10) والإصلاح الجزئي (PRD 10.7)
// نموذج لغوي يطبّق تعديلًا موضعيًا على المواصفة، وفرق الإصدارات يُحسب حتميًا.

import Anthropic from "@anthropic-ai/sdk";
import { INTERVIEW_MODEL, SPEC_SCHEMA } from "./interview";
import type { TaskSpec } from "./types";

const EDIT_TOOL: Anthropic.Tool = {
  name: "apply_spec_edit",
  description:
    "تطبيق التعديل المطلوب على مواصفة المهمة وإرجاعها كاملة بعد التعديل، مع ملخص قصير لما تغيّر.",
  input_schema: {
    type: "object",
    properties: {
      spec: SPEC_SCHEMA,
      change_summary: {
        type: "string",
        description: "جملة أو جملتان بالعربية تصفان ما تغيّر بالضبط",
      },
    },
    required: ["spec", "change_summary"],
    additionalProperties: false,
  },
};

const EDIT_SYSTEM = `أنت محرر مواصفات دقيق في منصة «وَتيرة».
تستلم مواصفة مهمة حالية وطلب تعديل، وتعيد المواصفة كاملة بعد تطبيق التعديل — مع الحفاظ الحرفي على كل جزء لم يطلب المستخدم تغييره (PRD 10.10: التعديل الآمن لا يمس الأجزاء السليمة).
قواعد:
- عدّل أقل قدر ممكن يحقق الطلب.
- حافظ على معرفات الخطوات (id) الموجودة؛ خطوة جديدة تأخذ id جديدًا.
- أي إرسال/حذف يبقى sensitive كما يجب (send/delete) — لا تخفف تصنيف الأمان أبدًا.
- إن كان الطلب إصلاح خطأ تقني: عدّل الخطوة المسببة فقط (المعاملات، التطبيق، الوصف) بأبسط تغيير يزيل سبب الفشل.
- استدعِ apply_spec_edit مرة واحدة بالمواصفة الكاملة المعدلة.`;

export async function applySpecEdit(
  spec: TaskSpec,
  instruction: string
): Promise<{ spec: TaskSpec; summary: string }> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: INTERVIEW_MODEL,
    max_tokens: 16000,
    system: EDIT_SYSTEM,
    tools: [EDIT_TOOL],
    messages: [
      {
        role: "user",
        content:
          "المواصفة الحالية:\n```json\n" +
          JSON.stringify(spec, null, 1) +
          "\n```\n\nطلب التعديل:\n" +
          instruction,
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) throw new Error("لم يُطبَّق التعديل — حاول بصياغة أوضح");
  const input = toolUse.input as { spec: TaskSpec; change_summary: string };
  return { spec: input.spec, summary: input.change_summary };
}

// فرق حتمي بين إصدارين — بالعربية للعرض في سجل الإصدارات
export function diffSpecs(oldSpec: TaskSpec, newSpec: TaskSpec): string {
  const parts: string[] = [];
  if (oldSpec.title !== newSpec.title)
    parts.push(`الاسم: «${oldSpec.title}» ← «${newSpec.title}»`);
  if (oldSpec.trigger.description !== newSpec.trigger.description)
    parts.push("تغيّر المحفز");

  const oldById = new Map(oldSpec.steps.map((s) => [s.id, s]));
  const newById = new Map(newSpec.steps.map((s) => [s.id, s]));

  for (const s of newSpec.steps) {
    const prev = oldById.get(s.id);
    if (!prev) {
      parts.push(`+ خطوة جديدة: «${s.name}»`);
    } else if (JSON.stringify(prev) !== JSON.stringify(s)) {
      parts.push(`~ تعدّلت: «${s.name}»`);
    }
  }
  for (const s of oldSpec.steps) {
    if (!newById.has(s.id)) parts.push(`- حُذفت: «${s.name}»`);
  }

  if (
    JSON.stringify(oldSpec.acceptance_criteria) !==
    JSON.stringify(newSpec.acceptance_criteria)
  )
    parts.push("تحدّثت شروط القبول");

  return parts.length ? parts.join(" • ") : "بلا تغييرات جوهرية";
}
