// أدوات الوكيل لخدمات جوجل الخمس.
//
// الوكيل لا يستدعي واجهات جوجل: كل أداة هنا تُترجم إلى إجراء يُرسل لمحرك n8n
// عبر triggerN8nWorkflow. فيبقى منطق التنفيذ في المحرك، والوكيل يقرّر فقط.

import type Anthropic from "@anthropic-ai/sdk";
import {
  triggerN8nWorkflow,
  type N8nResult,
  type WorkflowAction,
} from "./client";

interface ToolSpec {
  name: string;
  action: WorkflowAction;
  description: string;
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}

const SPECS: ToolSpec[] = [
  {
    name: "drive_create_file",
    action: "drive:create",
    description: "إنشاء ملف في Google Drive بمحتوى نصي.",
    properties: {
      name: { type: "string", description: "اسم الملف مع الامتداد" },
      content: { type: "string", description: "محتوى الملف النصي" },
      folder_id: { type: "string", description: "معرّف المجلد — اتركه فارغًا للجذر" },
    },
    required: ["name", "content"],
  },
  {
    name: "sheets_append_row",
    action: "sheets:append",
    description: "إضافة صف إلى جدول بيانات Google Sheets.",
    properties: {
      spreadsheet_id: { type: "string", description: "معرّف الجدول أو رابطه" },
      sheet_name: { type: "string", description: "اسم الورقة — الأولى إن تُرك فارغًا" },
      values: { type: "string", description: "قيم الصف مفصولة بفواصل، أو JSON لكائن الصف" },
    },
    required: ["spreadsheet_id", "values"],
  },
  {
    name: "slides_create_presentation",
    action: "slides:create",
    description: "إنشاء عرض تقديمي في Google Slides بعنوان وشرائح.",
    properties: {
      title: { type: "string", description: "عنوان العرض" },
      slides: {
        type: "string",
        description: 'شرائح بصيغة JSON: [{"title":"...","body":"..."}]',
      },
    },
    required: ["title"],
  },
  {
    name: "calendar_create_event",
    action: "calendar:createEvent",
    description: "إنشاء موعد في تقويم جوجل.",
    properties: {
      summary: { type: "string", description: "عنوان الموعد" },
      start: { type: "string", description: "البداية بصيغة ISO 8601" },
      end: { type: "string", description: "النهاية بصيغة ISO 8601" },
      attendees: { type: "string", description: "بُرد المدعوين مفصولة بفواصل" },
      description: { type: "string", description: "وصف الموعد" },
    },
    required: ["summary", "start", "end"],
  },
  {
    name: "docs_create_document",
    action: "docs:create",
    description: "إنشاء مستند في Google Docs بعنوان ومحتوى.",
    properties: {
      title: { type: "string", description: "عنوان المستند" },
      content: { type: "string", description: "نص المستند" },
    },
    required: ["title", "content"],
  },
];

/** خريطة اسم الأداة ← الإجراء، لتوجيه الاستدعاء بعد قرار النموذج */
export const TOOL_ACTIONS: Record<string, WorkflowAction> = Object.fromEntries(
  SPECS.map((s) => [s.name, s.action])
);

/** تعريفات الأدوات بصيغة Anthropic */
export const GOOGLE_TOOLS: Anthropic.Tool[] = SPECS.map((s) => ({
  name: s.name,
  description: s.description,
  input_schema: {
    type: "object",
    properties: s.properties,
    required: s.required,
  } as Anthropic.Tool.InputSchema,
}));

export const AGENT_SYSTEM = `أنت وكيل تنفيذ داخل منصة «وَتيرة».
تملك أدوات على خدمات جوجل: Drive وSheets وSlides وCalendar وDocs.

قواعد:
- استدعِ الأداة المناسبة عندما يطلب المستخدم إجراءً فعليًا. لا تصف ما ستفعله فقط.
- لا تخترع معرّفات (جداول، مجلدات، تقاويم). إن نقص معرّف فاسأل عنه.
- التواريخ بصيغة ISO 8601 كاملة مع المنطقة الزمنية.
- بعد نجاح الأداة، أخبر المستخدم بما تم في جملة قصيرة بالعربية.
- إن فشلت الأداة، انقل سبب الفشل كما وصلك بلا تجميل ولا إعادة محاولة عمياء.`;

/** ينفّذ استدعاء أداة قرّره النموذج، بتوجيهه إلى المحرك */
export async function runTool(
  toolName: string,
  input: Record<string, unknown>,
  userId: string
): Promise<N8nResult> {
  const action = TOOL_ACTIONS[toolName];
  if (!action)
    return {
      ok: false,
      status: 400,
      action: "drive:create",
      service: "unknown",
      error: `أداة غير معروفة: ${toolName}`,
      ms: 0,
    };
  return triggerN8nWorkflow(action, input, { userId });
}
