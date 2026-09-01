// محرك التقييم القاعدي — PRD قسم 8
// القرار لا يصدر من LLM؛ النموذج يستخرج الحقائق فقط وهذه القواعد تُقيّم.

import type {
  Evaluation,
  EvaluationFactor,
  GateResult,
  SolutionType,
  TaskSpec,
} from "./types";

const SUITABILITY_THRESHOLD = 55;

export function evaluateSpec(spec: TaskSpec): Evaluation {
  const gates = runGates(spec);
  const missing = collectMissingInfo(spec);

  if (gates.some((g) => !g.passed)) {
    return {
      suitable: false,
      score: 0,
      gates,
      factors: [],
      solution_types: [],
      explanation:
        "لم تجتز المهمة البوابات الإلزامية للأتمتة. راجع الأسباب أدناه — غالبًا ينقصنا وضوح في نقطة البداية أو النتيجة المتوقعة أو طريقة الاختبار.",
      missing_info: missing,
    };
  }

  const factors = scoreFactors(spec);
  const score = Math.round(
    factors.reduce((sum, f) => sum + f.score, 0)
  );
  const suitable = score >= SUITABILITY_THRESHOLD;
  const solution_types = suitable ? pickSolutionTypes(spec) : [];

  return {
    suitable,
    score,
    gates,
    factors,
    solution_types,
    explanation: suitable
      ? buildExplanation(score, solution_types, factors)
      : `الدرجة ${score}/100 أقل من حد القبول (${SUITABILITY_THRESHOLD}). ننصح بتحسين العملية أولًا — انظر العوامل المنخفضة أدناه.`,
    missing_info: missing,
  };
}

function runGates(spec: TaskSpec): GateResult[] {
  const gates: GateResult[] = [];

  gates.push({
    key: "trigger",
    label: "بداية واضحة للمهمة",
    passed: spec.trigger.description.trim().length > 0,
    reason: spec.trigger.description.trim().length > 0
      ? `تبدأ المهمة عندما: ${spec.trigger.description}`
      : "لم نعرف بعد ما الذي يُطلق المهمة.",
  });

  const verifiableOutput = spec.outputs.some((o) => o.verifiable);
  gates.push({
    key: "verifiable_output",
    label: "نتيجة متوقعة يمكن التحقق منها",
    passed: verifiableOutput,
    reason: verifiableOutput
      ? "توجد نتيجة نهائية يمكن فحصها آليًا."
      : "لا توجد نتيجة يمكن التحقق منها — لا نستطيع اختبار الحل.",
  });

  const hasAcceptance = spec.acceptance_criteria.length > 0;
  gates.push({
    key: "testable",
    label: "حالة اختبار محددة",
    passed: hasAcceptance,
    reason: hasAcceptance
      ? `لدينا ${spec.acceptance_criteria.length} شرط قبول للاختبار.`
      : "لا توجد شروط قبول — نحتاج مثالًا: إذا دخل كذا نتوقع كذا.",
  });

  const digitalTask =
    spec.inputs.length > 0 && spec.inputs.every((i) => i.digital);
  gates.push({
    key: "digital",
    label: "مدخلات رقمية",
    passed: digitalTask,
    reason: digitalTask
      ? "جميع المدخلات رقمية ومتاحة للأنظمة."
      : "بعض المدخلات ورقية أو غير رقمية — تحتاج رقمنة قبل الأتمتة.",
  });

  const buildableSteps = spec.steps.length > 0 &&
    spec.steps.every((s) => s.app !== "none_available");
  gates.push({
    key: "capabilities",
    label: "إجراءات ضمن التكاملات المتاحة",
    passed: buildableSteps,
    reason: buildableSteps
      ? "كل الخطوات قابلة للتنفيذ عبر التكاملات المدعومة (Gmail، Sheets، Drive، OpenAI)."
      : "توجد خطوات تتطلب أنظمة خارج التكاملات المدعومة حاليًا.",
  });

  return gates;
}

function scoreFactors(spec: TaskSpec): EvaluationFactor[] {
  const factors: EvaluationFactor[] = [];
  const steps = spec.steps;

  const stableCount = steps.filter((s) => s.stable).length;
  const stabilityRatio = steps.length ? stableCount / steps.length : 0;
  factors.push({
    key: "stability",
    label: "ثبات الخطوات",
    score: Math.round(stabilityRatio * 20),
    max: 20,
    reason: `${stableCount} من ${steps.length} خطوة ثابتة لا تتغير من حالة لأخرى.`,
  });

  const withRules = steps.filter(
    (s) => !s.decision_rule || s.decision_rule.trim().length > 0
  ).length;
  const rulesClarity = steps.length ? withRules / steps.length : 0;
  factors.push({
    key: "rules",
    label: "وضوح القواعد والقرارات",
    score: Math.round(rulesClarity * 15),
    max: 15,
    reason:
      spec.rules.length > 0
        ? `القرارات محكومة بـ ${spec.rules.length} قاعدة معلنة.`
        : "لا توجد قواعد قرار صريحة — سيُبنى على وصف الخطوات فقط.",
  });

  const highException = steps.filter((s) => s.exceptions_rate === "high").length;
  const medException = steps.filter((s) => s.exceptions_rate === "medium").length;
  const exceptionScore = Math.max(
    0,
    10 - highException * 4 - medException * 2
  );
  factors.push({
    key: "exceptions",
    label: "انخفاض نسبة الاستثناءات",
    score: exceptionScore,
    max: 10,
    reason:
      highException + medException === 0
        ? "الاستثناءات نادرة في كل الخطوات."
        : `${highException} خطوة باستثناءات مرتفعة و${medException} بمتوسطة — كل استثناء يخفض الدرجة.`,
  });

  const structuredInputs = spec.inputs.filter((i) => i.structured).length;
  const structRatio = spec.inputs.length
    ? structuredInputs / spec.inputs.length
    : 0;
  factors.push({
    key: "data_structure",
    label: "بنية البيانات",
    score: Math.round(5 + structRatio * 10),
    max: 15,
    reason: `${structuredInputs} من ${spec.inputs.length} مدخل منظم البنية؛ غير المنظم سيحتاج خطوة ذكاء اصطناعي.`,
  });

  const apiSteps = steps.filter((s) => s.app !== "logic").length;
  const integratedSteps = steps.filter(
    (s) => s.app !== "logic" && s.app !== "none_available"
  ).length;
  const apiRatio = apiSteps ? integratedSteps / apiSteps : 1;
  factors.push({
    key: "api",
    label: "توفر التكاملات",
    score: Math.round(apiRatio * 20),
    max: 20,
    reason: `${integratedSteps} من ${apiSteps} خطوة تطبيقية لها تكامل جاهز.`,
  });

  const verifiableCount = spec.outputs.filter((o) => o.verifiable).length;
  factors.push({
    key: "testability",
    label: "قابلية الاختبار",
    score: Math.min(10, verifiableCount * 5 + spec.acceptance_criteria.length * 3),
    max: 10,
    reason: `${verifiableCount} مخرج قابل للتحقق و${spec.acceptance_criteria.length} شرط قبول.`,
  });

  const sensitiveSteps = steps.filter((s) => s.sensitive !== "none").length;
  factors.push({
    key: "reversibility",
    label: "أمان الإجراءات",
    score: sensitiveSteps === 0 ? 10 : 7,
    max: 10,
    reason:
      sensitiveSteps === 0
        ? "لا توجد إجراءات حساسة."
        : `${sensitiveSteps} إجراء حساس (إرسال/حذف) يُنفَّذ مباشرةً — خصم بسيط للمخاطرة.`,
  });

  return factors;
}

// منطق اختيار نوع الحل — PRD قسم 8 (يمكن الجمع)
function pickSolutionTypes(spec: TaskSpec): SolutionType[] {
  const types = new Set<SolutionType>();

  if (spec.steps.some((s) => s.dynamic_tooling)) types.add("agentic");
  if (spec.steps.some((s) => s.needs_llm)) types.add("ai_assisted");
  if (types.size === 0) types.add("deterministic");
  if (!types.has("agentic") && !types.has("ai_assisted"))
    types.add("deterministic");

  const order: SolutionType[] = [
    "deterministic",
    "ai_assisted",
    "agentic",
    "human_in_loop",
  ];
  return order.filter((t) => types.has(t));
}

function collectMissingInfo(spec: TaskSpec): string[] {
  const missing: string[] = [];
  if (!spec.trigger.description.trim())
    missing.push("ما الذي يُطلق المهمة؟ (وصول إيميل؟ موعد؟ طلب يدوي؟)");
  if (spec.acceptance_criteria.length === 0)
    missing.push("مثال اختبار: إذا كان المدخل كذا، ما النتيجة الصحيحة المتوقعة؟");
  if (!spec.test_sample)
    missing.push("عينة بيانات حقيقية (أو شبه حقيقية) لتجربة الحل عليها.");
  spec.steps.forEach((s) => {
    if (s.app === "none_available")
      missing.push(`الخطوة «${s.name}» تحتاج نظامًا خارج تكاملاتنا — هل لها بديل عبر Gmail/Sheets/Drive؟`);
  });
  return missing;
}

function buildExplanation(
  score: number,
  types: SolutionType[],
  factors: EvaluationFactor[]
): string {
  const typeLabels: Record<SolutionType, string> = {
    deterministic: "سير عمل ثابت",
    ai_assisted: "خطوات مدعومة بالذكاء الاصطناعي",
    agentic: "سلوك وكيلي محدود",
    human_in_loop: "موافقة بشرية على الإجراءات الحساسة",
  };
  const best = [...factors].sort((a, b) => b.score / b.max - a.score / a.max)[0];
  const worst = [...factors].sort((a, b) => a.score / a.max - b.score / b.max)[0];
  return `المهمة مناسبة للأتمتة بدرجة ${score}/100. الحل المقترح: ${types
    .map((t) => typeLabels[t])
    .join(" + ")}. أقوى نقاطها «${best.label}» وأضعفها «${worst.label}» (${worst.reason})`;
}
