// بناء التمثيل الداخلي Workflow IR من مواصفة المهمة — حتمي بالكامل

import type { IREdge, IRNode, Provider, TaskSpec, WorkflowIR } from "./types";

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "task";
}

export function buildIR(spec: TaskSpec, flowId: string): WorkflowIR {
  const nodes: IRNode[] = [];
  const edges: IREdge[] = [];

  const triggerNode: IRNode = {
    id: "trigger",
    type: "trigger",
    label:
      spec.trigger.type === "schedule"
        ? "مجدول: " + (spec.trigger.schedule ?? "")
        : "بداية المهمة",
    operation:
      spec.trigger.type === "schedule" ? "schedule" : "platform_trigger",
    description: spec.trigger.description,
    params: {},
    provider: null,
    sensitive: "none",
    needsApproval: false,
  };
  nodes.push(triggerNode);

  let prev = triggerNode.id;
  let edgeCount = 0;

  const link = (from: string, to: string, label: string | null = null) => {
    edges.push({ id: `e${edgeCount++}`, source: from, target: to, label });
  };

  spec.steps.forEach((step, i) => {
    // خطوة «استقبال/وصول» الأولى هي المحفز نفسه — تمثلها عقدة البداية ولا تُبنى كإجراء
    if (
      i === 0 &&
      /استقبال|وصول|استلام|receive|incoming/i.test(step.name + " " + step.operation)
    ) {
      return;
    }
    const nodeId = `step-${i + 1}`;
    const isApp =
      step.app === "gmail" ||
      step.app === "google_sheets" ||
      step.app === "google_drive" ||
      step.app === "telegram" ||
      step.app === "slack" ||
      step.app === "instagram" ||
      step.app === "tiktok";
    const usesLlm = step.needs_llm || step.dynamic_tooling || step.app === "openai";

    const node: IRNode = {
      id: nodeId,
      type: usesLlm && !isApp ? "openai" : isApp ? (step.app as Provider) : step.decision_rule ? "condition" : "openai",
      label: step.name,
      operation: step.operation,
      description: step.description,
      params: {
        ...step.params,
        ...(step.decision_rule ? { rule: step.decision_rule } : {}),
      },
      provider: isApp ? (step.app as Provider) : usesLlm ? "openai" : null,
      sensitive: step.sensitive,
      needsApproval: step.sensitive !== "none",
    };

    if (step.app === "logic" && step.decision_rule) {
      node.type = "condition";
      node.provider = null;
    }
    if (step.app === "logic" && !step.decision_rule && !usesLlm) {
      node.type = "condition";
      node.provider = null;
      node.params = { rule: step.description };
    }

    if (node.needsApproval) {
      const approvalId = `approval-${i + 1}`;
      nodes.push({
        id: approvalId,
        type: "approval",
        label: "موافقتك مطلوبة",
        operation: "wait_for_approval",
        description: `قبل «${step.name}» يتوقف التنفيذ حتى توافق من داخل المنصة (${
          step.sensitive === "send" ? "إرسال" : "حذف"
        } لا يتم أبدًا بدون إذنك).`,
        params: { gated_step: step.name },
        provider: null,
        sensitive: "none",
        needsApproval: false,
      });
      link(prev, approvalId);
      prev = approvalId;
    }

    nodes.push(node);
    link(prev, nodeId, node.needsApproval ? "بعد الموافقة" : null);
    prev = nodeId;
  });

  const outputNode: IRNode = {
    id: "result",
    type: "output",
    label: "النتيجة",
    operation: "collect_result",
    description: spec.outputs.map((o) => o.name).join("، ") || "مخرجات المهمة",
    params: {},
    provider: null,
    sensitive: "none",
    needsApproval: false,
  };
  nodes.push(outputNode);
  link(prev, outputNode.id);

  return {
    name: spec.title,
    webhookPath: `mv-${slugify(spec.title)}-${flowId.slice(0, 8)}`,
    nodes,
    edges,
  };
}

export function requiredProviders(ir: WorkflowIR): Provider[] {
  const set = new Set<Provider>();
  ir.nodes.forEach((n) => {
    if (n.provider) set.add(n.provider);
  });
  return [...set];
}
