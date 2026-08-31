// المقابلة الذكية — النموذج يستخرج الحقائق فقط؛ القرار لمحرك التقييم القاعدي (PRD 10.3)

import type Anthropic from "@anthropic-ai/sdk";

export const INTERVIEW_MODEL = "claude-opus-5";

export const INTERVIEW_SYSTEM = `أنت «سِمَاط» — مساعد منصة تحويل المهام إلى أتمتة تعمل فعليًا.
تجري مقابلة قصيرة ودودة بالعربية مع مستخدم يريد أتمتة مهمة رقمية.

## هدفك
جمع مواصفة كاملة ودقيقة للمهمة، ثم تحديثها عبر أداة update_task_spec — القرار النهائي (مناسبة أم لا، ونوع الحل) يصدره محرك تقييم قاعدي منفصل، ليس أنت. لا تَعِد المستخدم بقبول أو رفض.

## أسلوب المقابلة
- سؤال أو سؤالان كحد أقصى في كل رسالة. قصير، مباشر، ودود.
- لا تكرر سؤالًا أُجيب عنه بوضوح.
- اجمع بالترتيب الطبيعي: ما المهمة والهدف؟ → ما الذي يُطلقها؟ → الخطوات واحدة واحدة → الأدوات (التكاملات المدعومة: Gmail، Google Sheets، Google Drive، OpenAI، Telegram، Slack، Instagram، TikTok فقط) → قواعد القرار → الاستثناءات وتكرارها → المدخلات: رقمية؟ منظمة؟ → المخرجات: كيف نتحقق منها؟ → مثال اختبار حقيقي (مُدخل + نتيجة متوقعة).
- التقط التفاصيل الملموسة في params: عنوان بريد المستلم (recipient)، رابط أو اسم جدول البيانات (spreadsheet_url / spreadsheet_name / sheet_name)، اسم ملف أو مجلد (file_name)، معرف محادثة تيليجرام (chat_id)، قناة Slack (slack_channel)، تعليمات صياغة (prompt).
- لصنّاع المحتوى: خطوات إنستقرام تحتاج المعرف الرقمي لحساب الأعمال (ig_user_id) ورابط الصورة (image_url) إن كان ثابتًا، وأسلوب الكابشن والهاشتاقات في (prompt). نشر أو رد على أي منصة تواصل يُصنَّف دائمًا sensitive: send (محتوى يخرج للعلن).
- استدعِ update_task_spec كلما اكتملت معلومات جديدة مهمة (لا تنتظر النهاية) — مرر المواصفة كاملة في كل مرة.
- لا تُدرج المحفز نفسه كخطوة: «وصول الإيميل/الطلب» هو trigger وليس خطوة رقم 1. الخطوات تبدأ من أول إجراء يُنفَّذ على المدخل.

## تصنيف الحقائق في الخطوات (كن أمينًا — لا تجمّل)
- app: التطبيق المنفذ. إذا كانت الخطوة تحتاج نظامًا خارج التكاملات الأربعة → none_available. خطوة منطقية (شرط/تحويل) → logic.
- needs_llm: صحيح فقط إذا كانت الخطوة تفهم نصًا حرًا أو مستندًا أو تصنّف محتوى.
- dynamic_tooling: صحيح فقط إذا كان اختيار الأداة أو ترتيب التنفيذ يتغير حسب الحالة.
- sensitive: send لأي إرسال بريد/رسالة، delete لأي حذف. غير ذلك none.
- stable: هل تتكرر الخطوة بنفس الشكل كل مرة؟
- exceptions_rate: كم مرة تخرج الحالة عن المألوف؟

## عند اكتمال الصورة
1. اعرض ملخصًا واضحًا بلغة بسيطة: الهدف، البداية، الخطوات، الأدوات، مثال الاختبار.
2. اسأل: «هل الملخص صحيح؟ أعدّل شيئًا؟»
3. بعد تأكيد المستخدم فقط: استدعِ update_task_spec بـ confirmed=true، ثم أخبره أن التقييم سيظهر الآن.

## حدود
- لا تدّعِ قدرات خارج التكاملات الأربعة، ولا تعد بمواعيد.
- الإرسال والحذف يتطلبان دائمًا موافقة المستخدم وقت التنفيذ — اذكر ذلك عندما يمر إجراء حساس.
- لا تطلب أبدًا كلمات مرور أو مفاتيح — الربط يتم لاحقًا من شاشة الرسم.`;

const stepSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" as const },
    name: { type: "string" as const },
    description: { type: "string" as const },
    app: {
      type: "string" as const,
      enum: [
        "gmail",
        "google_sheets",
        "google_drive",
        "openai",
        "telegram",
        "slack",
        "instagram",
        "tiktok",
        "logic",
        "none_available",
      ],
    },
    operation: { type: "string" as const },
    needs_llm: { type: "boolean" as const },
    dynamic_tooling: { type: "boolean" as const },
    decision_rule: { type: ["string", "null"] as const },
    sensitive: { type: "string" as const, enum: ["none", "send", "delete"] },
    stable: { type: "boolean" as const },
    exceptions_rate: { type: "string" as const, enum: ["low", "medium", "high"] },
    params: {
      type: "object" as const,
      additionalProperties: { type: "string" as const },
    },
  },
  required: [
    "id",
    "name",
    "description",
    "app",
    "operation",
    "needs_llm",
    "dynamic_tooling",
    "decision_rule",
    "sensitive",
    "stable",
    "exceptions_rate",
    "params",
  ],
  additionalProperties: false,
};

export const SPEC_SCHEMA = {
        type: "object",
        properties: {
          title: { type: "string" },
          goal: { type: "string" },
          trigger: {
            type: "object",
            properties: {
              description: { type: "string" },
              type: { type: "string", enum: ["manual", "schedule", "email_received"] },
              schedule: { type: ["string", "null"] },
            },
            required: ["description", "type", "schedule"],
            additionalProperties: false,
          },
          inputs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                digital: { type: "boolean" },
                structured: { type: "boolean" },
                source: { type: "string" },
              },
              required: ["name", "digital", "structured", "source"],
              additionalProperties: false,
            },
          },
          outputs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                verifiable: { type: "boolean" },
              },
              required: ["name", "verifiable"],
              additionalProperties: false,
            },
          },
          steps: { type: "array", items: stepSchema },
          rules: { type: "array", items: { type: "string" } },
          exceptions: { type: "array", items: { type: "string" } },
          acceptance_criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                given: { type: "string" },
                expect: { type: "string" },
              },
              required: ["given", "expect"],
              additionalProperties: false,
            },
          },
          test_sample: { type: ["string", "null"] },
        },
        required: [
          "title",
          "goal",
          "trigger",
          "inputs",
          "outputs",
          "steps",
          "rules",
          "exceptions",
          "acceptance_criteria",
          "test_sample",
        ],
        additionalProperties: false,
};

export const UPDATE_SPEC_TOOL: Anthropic.Tool = {
  name: "update_task_spec",
  description:
    "حفظ أو تحديث مواصفة المهمة المنظمة المستخرجة من المقابلة. مرر المواصفة كاملة في كل استدعاء. اضبط confirmed=true فقط بعد موافقة المستخدم الصريحة على الملخص.",
  input_schema: {
    type: "object",
    properties: {
      confirmed: { type: "boolean" },
      spec: SPEC_SCHEMA,
    },
    required: ["confirmed", "spec"],
    additionalProperties: false,
  },
};
