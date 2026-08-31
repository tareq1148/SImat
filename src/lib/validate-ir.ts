import type { IRNode, WorkflowIR } from "./types";

// فحص حتمي قبل البناء: يحدد بالضبط أي عقدة تنقصها أي حقول — لا غموض
// (يلتقط أيضًا القيم الوهمية التي قد يخترعها النموذج)

export interface BlockingIssue {
  node_id: string;
  node_label: string;
  missing: { field: string; label: string }[];
}

const FIELD_LABELS: Record<string, string> = {
  chat_id: "معرف المحادثة (chat_id)",
  spreadsheet_url: "رابط جدول البيانات",
  ig_user_id: "معرف حساب إنستقرام التجاري",
  image_url: "رابط الصورة",
  slack_channel: "قناة Slack",
};

const PLACEHOLDER = /^(123456789\d*|0+|your[_-]|<.*>|x{3,}|example|placeholder|test123)/i;

function missingOrFake(node: IRNode, field: string): boolean {
  const v = node.params[field]?.trim();
  if (!v) return true;
  return PLACEHOLDER.test(v);
}

export function validateIR(ir: WorkflowIR): BlockingIssue[] {
  const issues: BlockingIssue[] = [];
  for (const node of ir.nodes) {
    const missing: { field: string; label: string }[] = [];
    if (node.provider === "telegram" && missingOrFake(node, "chat_id"))
      missing.push({ field: "chat_id", label: FIELD_LABELS.chat_id });
    if (
      node.provider === "google_sheets" &&
      missingOrFake(node, "spreadsheet_url") &&
      !node.params.spreadsheet_name?.trim()
    )
      missing.push({ field: "spreadsheet_url", label: FIELD_LABELS.spreadsheet_url });
    if (node.provider === "instagram") {
      if (missingOrFake(node, "ig_user_id"))
        missing.push({ field: "ig_user_id", label: FIELD_LABELS.ig_user_id });
      if (missingOrFake(node, "image_url"))
        missing.push({ field: "image_url", label: FIELD_LABELS.image_url });
    }
    if (node.provider === "slack" && missingOrFake(node, "slack_channel"))
      missing.push({ field: "slack_channel", label: FIELD_LABELS.slack_channel });
    if (missing.length)
      issues.push({ node_id: node.id, node_label: node.label, missing });
  }
  return issues;
}
