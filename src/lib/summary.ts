// استجابة UI-ready مختصرة — تُبنى قاعديًا من بيانات التقييم والرسم (بدون LLM)
// تطابق مخطط بطاقات الربط: required_integrations مع أزرار + Connect

import type {
  ConnectionRow,
  Evaluation,
  FlowRow,
  Provider,
  SolutionType,
  TaskSpec,
  WorkflowIR,
} from "./types";
import { PROVIDER_LABELS } from "./types";

export interface UiIntegration {
  id: Provider;
  display_name: string;
  service_type: "oauth2" | "api_key";
  status: "CONNECTED" | "DISCONNECTED";
  action_label: string;
}

export interface UiSummary {
  status: "SUCCESS" | "NOT_SUITABLE";
  ui_message: string;
  summary: {
    process_name: string;
    feasibility_score: number;
    architecture_pattern: string;
  };
  required_integrations: UiIntegration[];
  steps_breakdown: {
    step_number: number;
    action: string;
    execution_type: string;
    tool: string;
    requires_human_approval: boolean;
  }[];
  n8n_integration: {
    workflow_name: string;
    status:
      | "AWAITING_CONNECTIONS"
      | "READY_FOR_DEPLOYMENT"
      | "DEPLOYED"
      | "DEPLOYED_ACTIVE"
      | "NOT_APPLICABLE";
  };
}

const SERVICE_TYPES: Record<Provider, "oauth2" | "api_key"> = {
  gmail: "oauth2",
  google_sheets: "oauth2",
  google_drive: "oauth2",
  google_slides: "oauth2",
  google_calendar: "oauth2",
  google_docs: "oauth2",
  openai: "api_key",
  telegram: "api_key",
  slack: "oauth2",
  instagram: "oauth2",
  tiktok: "oauth2",
  removebg: "api_key",
};

const TOOL_LABELS: Record<string, string> = {
  gmail: "Gmail API / n8n",
  google_sheets: "Google Sheets API / n8n",
  google_drive: "Google Drive API / n8n",
  google_docs: "Google Docs API / n8n",
  google_slides: "Google Slides API / n8n",
  google_calendar: "Google Calendar API / n8n",
  openai: "OpenAI (LLM) / n8n",
  telegram: "Telegram Bot API / n8n",
  slack: "Slack API / n8n",
  instagram: "Instagram Graph API / n8n",
  tiktok: "TikTok Content API / n8n",
  removebg: "remove.bg API / n8n",
  logic: "n8n IF/Switch",
  none_available: "غير متوفر",
};

export function architecturePattern(types: SolutionType[]): string {
  const parts: string[] = ["n8n"];
  if (types.includes("ai_assisted") || types.includes("agentic")) parts.push("AI");
  if (types.includes("agentic")) parts.push("Agentic");
  if (types.includes("human_in_loop")) parts.push("Human-in-the-loop");
  return parts.length === 1 ? "Deterministic (n8n)" : `Hybrid (${parts.join(" + ")})`;
}

export function buildUiSummary(
  flow: FlowRow,
  ir: WorkflowIR | null,
  spec: TaskSpec | null,
  connections: ConnectionRow[]
): UiSummary {
  const ev = flow.evaluation as Evaluation | null;
  const connected = new Set(
    connections.filter((c) => c.status === "connected").map((c) => c.provider)
  );

  // التكاملات المطلوبة من الرسم (المصدر الحقيقي للتنفيذ).
  // OpenAI مستثنى: المنصة توفّره لكل مسار عبر N8N_CRED_OPENAI، فلا يُعرض
  // كبطاقة ربط ولا يُحتسب ناقصًا — مطالبة المستخدم به تحجب مسارًا جاهزًا.
  const needed = new Set<Provider>();
  ir?.nodes.forEach((n) => {
    if (n.provider && n.provider !== "openai") needed.add(n.provider);
  });

  const required_integrations: UiIntegration[] = [...needed].map((p) => ({
    id: p,
    display_name: PROVIDER_LABELS[p],
    service_type: SERVICE_TYPES[p],
    status: connected.has(p) ? "CONNECTED" : "DISCONNECTED",
    action_label: connected.has(p)
      ? `✓ ${PROVIDER_LABELS[p]} متصل`
      : `اتصل بـ ${PROVIDER_LABELS[p]}`,
  }));

  const missingCount = required_integrations.filter(
    (i) => i.status === "DISCONNECTED"
  ).length;

  const steps_breakdown = (spec?.steps ?? []).map((s, i) => ({
    step_number: i + 1,
    action: s.name,
    execution_type: s.needs_llm && s.app !== "openai" ? "ai_assisted" : mapType(s.app, s),
    tool: TOOL_LABELS[s.app] ?? s.app,
    requires_human_approval: false,
  }));

  const notSuitable = ev ? !ev.suitable : false;
  const n8nStatus: UiSummary["n8n_integration"]["status"] = notSuitable
    ? "NOT_APPLICABLE"
    : flow.n8n_workflow_id
      ? flow.status === "Active"
        ? "DEPLOYED_ACTIVE"
        : "DEPLOYED"
      : missingCount > 0
        ? "AWAITING_CONNECTIONS"
        : "READY_FOR_DEPLOYMENT";

  return {
    status: notSuitable ? "NOT_SUITABLE" : "SUCCESS",
    ui_message: notSuitable
      ? "المهمة غير مناسبة للأتمتة حاليًا — راجع أسباب التقييم."
      : missingCount > 0
        ? "جاري تجهيز الأتمتة. يرجى ربط الحسابات التالية لتمكين النظام من التنفيذ:"
        : flow.n8n_workflow_id
          ? "الحل مبني في محرك التنفيذ — جاهز للاختبار والتشغيل."
          : "كل الحسابات مربوطة — جاهز للإنشاء في محرك التنفيذ.",
    summary: {
      process_name: flow.name,
      feasibility_score: ev?.score ?? 0,
      architecture_pattern: architecturePattern(flow.solution_types ?? []),
    },
    required_integrations,
    steps_breakdown,
    n8n_integration: {
      workflow_name: `[وَتيرة] ${flow.name}`,
      status: n8nStatus,
    },
  };
}

function mapType(
  app: string,
  s: { needs_llm: boolean; dynamic_tooling: boolean; sensitive: string }
): string {
  if (s.dynamic_tooling) return "agentic";
  if (s.needs_llm || app === "openai") return "ai_assisted";
  if (app === "none_available") return "not_suitable";
  return "deterministic";
}
