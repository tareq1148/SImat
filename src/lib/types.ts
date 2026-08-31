// النموذج المنطقي لمنصة «وَتيرة» — PRD قسم 14

export type Provider =
  | "gmail"
  | "google_sheets"
  | "google_drive"
  | "openai"
  | "telegram"
  | "slack"
  | "instagram"
  | "tiktok";

export type StepApp = Provider | "logic" | "none_available";

export type SensitiveAction = "none" | "send" | "delete";

export interface SpecStep {
  id: string;
  name: string;
  description: string;
  app: StepApp;
  operation: string;
  needs_llm: boolean;
  dynamic_tooling: boolean;
  decision_rule: string | null;
  sensitive: SensitiveAction;
  stable: boolean;
  exceptions_rate: "low" | "medium" | "high";
  params: Record<string, string>;
}

export interface TaskSpec {
  title: string;
  goal: string;
  trigger: {
    description: string;
    type: "manual" | "schedule" | "email_received";
    schedule: string | null;
  };
  inputs: { name: string; digital: boolean; structured: boolean; source: string }[];
  outputs: { name: string; verifiable: boolean }[];
  steps: SpecStep[];
  rules: string[];
  exceptions: string[];
  acceptance_criteria: { given: string; expect: string }[];
  test_sample: string | null;
}

export type SolutionType =
  | "deterministic"
  | "ai_assisted"
  | "agentic"
  | "human_in_loop";

export interface EvaluationFactor {
  key: string;
  label: string;
  score: number;
  max: number;
  reason: string;
}

export interface GateResult {
  key: string;
  label: string;
  passed: boolean;
  reason: string;
}

export interface Evaluation {
  suitable: boolean;
  score: number;
  gates: GateResult[];
  factors: EvaluationFactor[];
  solution_types: SolutionType[];
  explanation: string;
  missing_info: string[];
}

// ===== التمثيل الداخلي Workflow IR =====

export type IRNodeType =
  | "trigger"
  | "gmail"
  | "google_sheets"
  | "google_drive"
  | "openai"
  | "telegram"
  | "slack"
  | "instagram"
  | "tiktok"
  | "condition"
  | "approval"
  | "output";

export interface IRNode {
  id: string;
  type: IRNodeType;
  label: string;
  operation: string;
  description: string;
  params: Record<string, string>;
  provider: Provider | null;
  sensitive: SensitiveAction;
  needsApproval: boolean;
}

export interface IREdge {
  id: string;
  source: string;
  target: string;
  label: string | null;
}

export interface WorkflowIR {
  name: string;
  webhookPath: string;
  nodes: IRNode[];
  edges: IREdge[];
}

export type FlowStatus =
  | "Draft"
  | "NeedsInformation"
  | "NeedsConnections"
  | "ReadyToTest"
  | "Testing"
  | "NeedsRepair"
  | "Ready"
  | "Active"
  | "Paused"
  | "NotSuitable";

export interface FlowRow {
  id: string;
  user_id: string;
  task_spec_id: string | null;
  name: string;
  solution_types: SolutionType[];
  evaluation: Evaluation | null;
  status: FlowStatus;
  n8n_workflow_id: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface ConnectionRow {
  id: string;
  provider: Provider;
  label: string;
  n8n_credential_id: string | null;
  status: "connected" | "revoked";
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  gmail: "Gmail",
  google_sheets: "Google Sheets",
  google_drive: "Google Drive",
  openai: "OpenAI",
  telegram: "Telegram",
  slack: "Slack",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export const STATUS_LABELS: Record<FlowStatus, string> = {
  Draft: "مسودة",
  NeedsInformation: "تحتاج معلومات",
  NeedsConnections: "تحتاج ربط حسابات",
  ReadyToTest: "جاهزة للاختبار",
  Testing: "قيد الاختبار",
  NeedsRepair: "تحتاج إصلاحًا",
  Ready: "جاهزة",
  Active: "مفعّلة",
  Paused: "متوقفة",
  NotSuitable: "غير مناسبة للأتمتة",
};
