// تشخيص الأعطال — يحوّل خطأ المحرك الخام إلى جملة يفهمها صاحب المهمة وخطوة يفعلها.
// طبقتان: قواعد حتمية تلتقط الأعطال المعروفة فورًا وبلا تكلفة، ثم النموذج لما تبقّى.
// القواعد أولًا عمدًا: أشهر الأعطال (توكن منتهٍ، بوت محظور، مسار متوقف) لها إجابة
// واحدة صحيحة، ولا يصح أن تتوقف على مفتاح API أو على اتصال بالشبكة.

import Anthropic from "@anthropic-ai/sdk";
import { INTERVIEW_MODEL } from "./interview";

export type FixAction = "reconnect" | "repair" | "edit" | "retry" | "activate" | "none";

export interface Diagnosis {
  /** السبب التقني المختصر — للعرض للمطوّر لا للمستخدم */
  cause: string;
  /** الجملة التي يقرأها صاحب المهمة */
  message: string;
  message_en: string;
  /** الخطوة التي تُصلح العطل */
  action: FixAction;
  action_label: string;
  /** blocking: يحتاج تدخلك | transient: عارض يزول بإعادة المحاولة */
  severity: "blocking" | "transient";
  /** الخدمة المتسببة إن عُرفت */
  provider: string | null;
  at: string;
}

const ACTION_LABELS: Record<FixAction, { ar: string; en: string }> = {
  reconnect: { ar: "أعد الربط", en: "Reconnect" },
  repair: { ar: "إصلاح تلقائي", en: "Auto-repair" },
  edit: { ar: "عدّل المسار", en: "Edit flow" },
  retry: { ar: "أعد المحاولة", en: "Retry" },
  activate: { ar: "فعّل المسار", en: "Activate" },
  none: { ar: "افتح المسار", en: "Open flow" },
};

interface Rule {
  test: RegExp;
  provider: string | null;
  action: FixAction;
  severity: Diagnosis["severity"];
  cause: string;
  message: string;
  message_en: string;
}

// أنماط مأخوذة من نصوص أخطاء n8n وواجهات المزوّدين الفعلية
const RULES: Rule[] = [
  {
    test: /invalid_grant|refresh token|token (has )?expired|invalid_token|unauthorized_client/i,
    provider: "google",
    action: "reconnect",
    severity: "blocking",
    cause: "انتهت صلاحية توكن Google",
    message:
      "انتهت صلاحية ربط حساب Google — أعد تسجيل الدخول من «الإعدادات ← الاتصالات» ليكمل المسار عمله.",
    message_en:
      "Your Google connection expired — sign in again from Settings → Connections to resume this flow.",
  },
  {
    test: /credentials that are not shared|credential .*(not found|deleted)|no credentials? (got )?set/i,
    provider: null,
    action: "reconnect",
    severity: "blocking",
    cause: "اعتماد مفقود أو غير مشارَك في المحرك",
    message:
      "الحساب المربوط بهذه الخطوة لم يعد متاحًا — أعد ربطه من «الإعدادات ← الاتصالات» ثم أعد التشغيل.",
    message_en:
      "The account linked to this step is no longer available — reconnect it in Settings → Connections, then run again.",
  },
  {
    test: /bot was blocked|chat not found|bot can't initiate|forbidden: bot/i,
    provider: "telegram",
    action: "edit",
    severity: "blocking",
    cause: "تلقرام يرفض الإرسال لهذه المحادثة",
    message:
      "تلقرام رفض الإرسال: افتح محادثة البوت وأرسل /start مرة واحدة، ثم أعد التشغيل.",
    message_en:
      "Telegram refused to deliver: open the bot chat and send /start once, then run again.",
  },
  {
    test: /401|403|authentication failed|invalid api key|api key .*(invalid|missing)/i,
    provider: null,
    action: "reconnect",
    severity: "blocking",
    cause: "رفض مصادقة من الخدمة",
    message:
      "الخدمة رفضت المفتاح المستخدم في هذه الخطوة — أعد ربط الحساب بمفتاح صالح.",
    message_en:
      "The service rejected the key used by this step — reconnect the account with a valid key.",
  },
  {
    test: /429|rate limit|too many requests|quota exceeded/i,
    provider: null,
    action: "retry",
    severity: "transient",
    cause: "تجاوز حد الطلبات",
    message:
      "الخدمة تجاوزت حد الطلبات المسموح مؤقتًا — أعد التشغيل بعد قليل، ولا يحتاج المسار تعديلًا.",
    message_en:
      "The service hit its rate limit — try again shortly; the flow itself needs no change.",
  },
  {
    test: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up|network|timeout|503|502|504/i,
    provider: null,
    action: "retry",
    severity: "transient",
    cause: "تعذّر الوصول للخدمة",
    message:
      "الخدمة لم تستجب في هذه المحاولة — عطل عارض غالبًا، أعد التشغيل.",
    message_en: "The service did not respond this time — likely transient, run it again.",
  },
  {
    test: /workflow.*not active|webhook.*not registered|is not active/i,
    provider: "n8n",
    action: "activate",
    severity: "blocking",
    cause: "المسار غير مفعّل في المحرك",
    message: "المسار متوقف في المحرك — فعّله ليستقبل التشغيل.",
    message_en: "The flow is inactive in the engine — activate it to accept runs.",
  },
];

function ruleDiagnosis(raw: string): Diagnosis | null {
  const hit = RULES.find((r) => r.test.test(raw));
  if (!hit) return null;
  return {
    cause: hit.cause,
    message: hit.message,
    message_en: hit.message_en,
    action: hit.action,
    action_label: ACTION_LABELS[hit.action].ar,
    severity: hit.severity,
    provider: hit.provider,
    at: new Date().toISOString(),
  };
}

// الملاذ الأخير: لا قاعدة طابقت ولا نموذج متاح — لا نعرض كود الخطأ للمستخدم أبدًا
function genericDiagnosis(node: string | null): Diagnosis {
  return {
    cause: "فشل غير مصنَّف",
    message: node
      ? `توقّف المسار عند خطوة «${node}» ولم يكمل. جرّب الإصلاح التلقائي، وإن تكرر افتح المسار وراجع الخطوة.`
      : "توقّف المسار قبل أن يكمل. جرّب الإصلاح التلقائي، وإن تكرر افتح المسار وراجع خطواته.",
    message_en: node
      ? `The flow stopped at step "${node}". Try auto-repair; if it repeats, open the flow and review that step.`
      : "The flow stopped before finishing. Try auto-repair; if it repeats, open the flow and review its steps.",
    action: "repair",
    action_label: ACTION_LABELS.repair.ar,
    severity: "blocking",
    provider: null,
    at: new Date().toISOString(),
  };
}

const DIAGNOSE_TOOL: Anthropic.Tool = {
  name: "report_diagnosis",
  description:
    "سجّل تشخيص عطل الأتمتة بصيغة منظمة: سبب تقني مختصر، ورسالة للمستخدم، والخطوة التي تصلحه.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      cause: { type: "string", description: "السبب التقني في أقل من ١٢ كلمة" },
      message: {
        type: "string",
        description:
          "جملة أو جملتان بالعربية لصاحب المهمة: ما الذي تعطّل وماذا يفعل. بلا مصطلحات تقنية وبلا أكواد خطأ.",
      },
      message_en: { type: "string", description: "الترجمة الإنجليزية لنفس الرسالة" },
      action: {
        type: "string",
        enum: ["reconnect", "repair", "edit", "retry", "activate", "none"],
        description:
          "reconnect: يحتاج إعادة ربط حساب | repair: إصلاح تلقائي | edit: تعديل المسار | retry: عارض أعد المحاولة | activate: المسار متوقف | none: غير ذلك",
      },
      severity: {
        type: "string",
        enum: ["blocking", "transient"],
        description: "transient فقط إن كان يزول بإعادة المحاولة بلا تدخل",
      },
      provider: {
        type: ["string", "null"],
        description: "الخدمة المتسببة إن عُرفت: gmail أو telegram أو slack أو google أو n8n",
      },
    },
    required: ["cause", "message", "message_en", "action", "severity", "provider"],
    additionalProperties: false,
  },
};

const SYSTEM = `أنت مهندس موثوقية في منصة «وَتيرة» للأتمتة.
يصلك خطأ خام من محرك التنفيذ، ومهمتك أن تحوّله إلى تشخيص يفهمه صاحب المهمة — وهو موظف غير تقني.

قواعد صارمة:
- لا تذكر أكواد خطأ ولا أسماء عقد تقنية ولا JSON في رسالة المستخدم.
- ابدأ بما تعطّل فعليًا من وجهة نظره، ثم الخطوة الواحدة التي تصلحه.
- لا تخترع سببًا: إن لم يكن الخطأ واضحًا فاجعل action=repair ورسالة عامة صادقة.
- لا تَعِد بأن المشكلة ستُحل تلقائيًا ما لم يكن الخطأ عارضًا فعلًا.
استدع أداة report_diagnosis دائمًا.`;

export async function diagnoseFailure(input: {
  flowName: string;
  node: string | null;
  rawError: string;
}): Promise<Diagnosis> {
  const raw = (input.rawError ?? "").slice(0, 2000);

  // ١) القواعد الحتمية — مجانية وفورية وتغطي أشهر الأعطال
  const byRule = ruleDiagnosis(raw);
  if (byRule) return byRule;

  // ٢) النموذج لما لم تلتقطه القاعدة
  if (!process.env.ANTHROPIC_API_KEY) return genericDiagnosis(input.node);

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: INTERVIEW_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: [DIAGNOSE_TOOL],
      tool_choice: { type: "tool", name: "report_diagnosis" },
      messages: [
        {
          role: "user",
          content: `المسار: «${input.flowName}»
الخطوة المتعطلة: ${input.node ?? "غير معروفة"}
الخطأ الخام من المحرك:
${raw}`,
        },
      ],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return genericDiagnosis(input.node);
    const out = block.input as Omit<Diagnosis, "action_label" | "at">;
    return {
      ...out,
      action_label: ACTION_LABELS[out.action]?.ar ?? ACTION_LABELS.none.ar,
      at: new Date().toISOString(),
    };
  } catch {
    // انقطاع أو رصيد منتهٍ — لا يصح أن يمنع تسجيل العطل
    return genericDiagnosis(input.node);
  }
}

/** تشخيص فوري بلا نموذج — لصفوف قديمة سُجّلت قبل هذه الميزة */
export function quickDiagnosis(raw: string, node: string | null): Diagnosis {
  return ruleDiagnosis(raw ?? "") ?? genericDiagnosis(node);
}
