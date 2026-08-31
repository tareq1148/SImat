// فحص دخاني: مواصفة → تقييم → IR → n8n JSON
import { evaluateSpec } from "../src/lib/scoring.ts";
import { buildIR } from "../src/lib/ir.ts";
import { irToN8n, missingProviders } from "../src/lib/adapter.ts";
import type { TaskSpec } from "../src/lib/types.ts";

const spec: TaskSpec = {
  title: "invoice-intake",
  goal: "تسجيل فواتير الموردين الواردة بالبريد في جدول ثم إشعار المحاسب",
  trigger: {
    description: "وصول بريد فيه فاتورة PDF",
    type: "manual",
    schedule: null,
  },
  inputs: [
    { name: "نص الفاتورة", digital: true, structured: false, source: "Gmail" },
  ],
  outputs: [{ name: "صف في الجدول", verifiable: true }],
  steps: [
    {
      id: "s1",
      name: "استخراج بيانات الفاتورة",
      description: "قراءة نص الفاتورة واستخراج المورد والمبلغ والتاريخ",
      app: "openai",
      operation: "extract",
      needs_llm: true,
      dynamic_tooling: false,
      decision_rule: null,
      sensitive: "none",
      stable: true,
      exceptions_rate: "low",
      params: {},
    },
    {
      id: "s2",
      name: "تسجيل في الجدول",
      description: "إضافة صف بالبيانات المستخرجة",
      app: "google_sheets",
      operation: "append",
      needs_llm: false,
      dynamic_tooling: false,
      decision_rule: null,
      sensitive: "none",
      stable: true,
      exceptions_rate: "low",
      params: { sheet_name: "Invoices" },
    },
    {
      id: "s3",
      name: "إشعار المحاسب",
      description: "إرسال بريد ملخص للمحاسب",
      app: "gmail",
      operation: "send",
      needs_llm: false,
      dynamic_tooling: false,
      decision_rule: null,
      sensitive: "send",
      stable: true,
      exceptions_rate: "low",
      params: { recipient: "acc@example.com" },
    },
    {
      id: "s4",
      name: "تنبيه تيليجرام للمدير",
      description: "إرسال تنبيه بالفاتورة المسجلة إلى محادثة المدير",
      app: "telegram",
      operation: "sendMessage",
      needs_llm: false,
      dynamic_tooling: false,
      decision_rule: null,
      sensitive: "send",
      stable: true,
      exceptions_rate: "low",
      params: { chat_id: "12345" },
    },
    {
      id: "s5",
      name: "نشر ملخص على إنستقرام",
      description: "نشر صورة ملخص الفواتير الأسبوعي على حساب الشركة",
      app: "instagram",
      operation: "publish_image",
      needs_llm: false,
      dynamic_tooling: false,
      decision_rule: null,
      sensitive: "send",
      stable: true,
      exceptions_rate: "low",
      params: { ig_user_id: "17840000000000000", image_url: "https://example.com/summary.png" },
    },
  ],
  rules: ["المبلغ فوق 5000 يحتاج مراجعة"],
  exceptions: ["فاتورة بدون مبلغ"],
  acceptance_criteria: [
    { given: "فاتورة من مورد X بمبلغ 100", expect: "صف جديد باسم X ومبلغ 100" },
  ],
  test_sample: "فاتورة رقم 55 من شركة الاختبار بمبلغ 100 ريال بتاريخ 2026-01-01",
};

const ev = evaluateSpec(spec);
console.log("SCORE:", ev.score, "suitable:", ev.suitable);
console.log("TYPES:", ev.solution_types.join(","));
if (!ev.suitable) throw new Error("expected suitable");
if (!ev.solution_types.includes("human_in_loop"))
  throw new Error("expected human_in_loop for send step");

const ir = buildIR(spec, "abcd1234-0000");
console.log(
  "IR nodes:",
  ir.nodes.map((n) => `${n.id}:${n.type}`).join(" | ")
);
const approvalCount = ir.nodes.filter((n) => n.type === "approval").length;
if (approvalCount !== 3)
  throw new Error("expected 3 approval gates (gmail + telegram + instagram)");

const payload = irToN8n(ir, {
  gmail: { id: "g", name: "Gmail" },
  google_sheets: { id: "s", name: "Sheets" },
  openai: { id: "o", name: "OpenAI" },
  telegram: { id: "t", name: "Telegram" },
  instagram: { id: "ig", name: "Facebook Graph account" },
});
console.log("n8n nodes:", payload.nodes.length);
const names = (payload.nodes as { name: string }[]).map((n) => n.name);
console.log("names:", names.join(" | "));

// كل الروابط تشير لعقد موجودة
const conn = payload.connections as Record<string, { main?: { node: string }[][] }>;
for (const [src, val] of Object.entries(conn)) {
  if (!names.includes(src)) throw new Error(`connection source missing: ${src}`);
  (val.main ?? []).flat().forEach((t) => {
    if (!names.includes(t.node)) throw new Error(`target missing: ${t.node}`);
  });
}

// الحماية: المعاينة (وضع الاختبار) يجب ألا تؤدي إلى عقدة الإرسال الفعلية
const previewTargets = (conn["معاينة بدون تنفيذ 1"]?.main ?? [])
  .flat()
  .map((t) => t.node);
if (previewTargets.includes("إشعار المحاسب"))
  throw new Error("TEST MODE LEAK: preview path reaches real send node!");
console.log("preview →", previewTargets.join(","));

// الإرسال الفعلي يصل فقط من فرع الموافقة
const approvedTargets = (conn["تمت الموافقة؟ 1"]?.main ?? [[]])[0].map((t) => t.node);
if (!approvedTargets.includes("إشعار المحاسب"))
  throw new Error("send node not on approved branch");

// بوابة تيليجرام: المعاينة 2 لا تصل لعقدة الإرسال
const preview2 = (conn["معاينة بدون تنفيذ 2"]?.main ?? []).flat().map((t) => t.node);
if (preview2.includes("تنبيه تيليجرام للمدير"))
  throw new Error("TEST MODE LEAK: telegram send reachable from preview!");
const approved2 = (conn["تمت الموافقة؟ 2"]?.main ?? [[]])[0].map((t) => t.node);
if (!approved2.includes("تنبيه تيليجرام للمدير"))
  throw new Error("telegram send not on approved branch");

// إنستقرام: النشر لا يصل إلا من فرع الموافقة، وعبر حاوية التجهيز
const preview3 = (conn["معاينة بدون تنفيذ 3"]?.main ?? []).flat().map((t) => t.node);
if (preview3.some((n) => n.includes("نشر ملخص")))
  throw new Error("TEST MODE LEAK: instagram publish reachable from preview!");
const approved3 = (conn["تمت الموافقة؟ 3"]?.main ?? [[]])[0].map((t) => t.node);
if (!approved3.includes("تجهيز المنشور: نشر ملخص على إنستقرام"))
  throw new Error("instagram container not on approved branch");
const containerOut = (conn["تجهيز المنشور: نشر ملخص على إنستقرام"]?.main ?? [[]])[0].map((t) => t.node);
if (!containerOut.includes("نشر ملخص على إنستقرام"))
  throw new Error("container does not chain to publish");

const missing = missingProviders(ir, {});
console.log("missing (no creds):", missing.join(","));

console.log("SMOKE_OK");
