// إصلاح مسار التيليجرام وتجربته كاملًا حتى وصول الرسالة الحقيقية للبوت
// التشغيل:  node --experimental-strip-types scripts/fix-telegram-e2e.ts [test|run]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (t.startsWith("#")) continue;
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(t);
  if (m) process.env[m[1]] = m[2];
}

const FLOW_ID = "947be3be-aa4d-422a-94c0-86b1c467ea07";
const USER_ID = "3b4b624f-eb72-4c03-9188-a6759916edeb";
const CHAT_ID = "448339037"; // محادثة تريق مع @TAE3RS_BOT (من /start)
const MODE = process.argv[2] ?? "test";

async function main() {
const { createClient } = await import("@supabase/supabase-js");
const { publishNewVersion } = await import("../src/lib/versioning.ts");
const { irToN8n } = await import("../src/lib/adapter.ts");
const { updateWorkflow, activateWorkflow, callFlowWebhook, resumeExecution } =
  await import("../src/lib/n8n.ts");
const { activeConnections } = await import("../src/lib/connections.ts");
type Any = any;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1) حفظ chat_id الحقيقي في اتصال تيليجرام
await sb
  .from("connections")
  .update({ metadata: { source: "user", chat_id: CHAT_ID } })
  .eq("user_id", USER_ID)
  .eq("provider", "telegram");
console.log("1) chat_id saved to connection metadata");

// 2) إصلاح المواصفة (استبدال الوهمي 123456789) وإصدار جديد
const { data: flow } = await sb
  .from("flows")
  .select("*, task_specs(full_spec)")
  .eq("id", FLOW_ID)
  .single();
if (!flow) throw new Error("flow not found");
const spec = (flow.task_specs as Any).full_spec;
const tgStep = spec.steps.find((s: Any) => s.app === "telegram");
tgStep.params = { ...tgStep.params, chat_id: CHAT_ID };
const { version } = await publishNewVersion(
  sb as Any,
  { id: flow.id, task_spec_id: flow.task_spec_id, current_version: flow.current_version },
  spec,
  "إصلاح: chat_id الحقيقي لبوت @TAE3RS_BOT بدل القيمة الوهمية"
);
console.log("2) new version:", version);

// 3) إعادة البناء والتفعيل في المحرك (برابط النفق الجديد للتبليغات)
const { data: vr } = await sb
  .from("flow_versions")
  .select("ir")
  .eq("flow_id", FLOW_ID)
  .eq("version", version)
  .single();
const ir = vr!.ir as Any;
const { data: conns } = await sb
  .from("connections")
  .select("provider,label,n8n_credential_id,metadata,status")
  .eq("user_id", USER_ID)
  .eq("status", "connected");
const credMap: Any = {};
activeConnections(conns as Any).forEach((c: Any) => {
  if (c.n8n_credential_id) credMap[c.provider] = { id: c.n8n_credential_id, name: c.label };
});
console.log("3) creds:", Object.keys(credMap).join(", "), "| APP_BASE_URL:", process.env.APP_BASE_URL);
const payload = irToN8n(ir, credMap);
await updateWorkflow(flow.n8n_workflow_id, payload);
await activateWorkflow(flow.n8n_workflow_id);
await sb.from("flows").update({ status: "ReadyToTest" }).eq("id", FLOW_ID);
console.log("   rebuilt + ACTIVE:", flow.n8n_workflow_id);

// 4) اختبار آمن (لا إرسال — معاينة فقط)
const { data: t } = await sb
  .from("test_runs")
  .insert({
    flow_id: FLOW_ID,
    version,
    input: { sample: "رسالة تجريبية" },
    expected: spec.acceptance_criteria ?? [],
  })
  .select("id")
  .single();
const th = await callFlowWebhook(ir.webhookPath, {
  run_token: `test:${t!.id}`,
  test_mode: true,
  input: { sample: "رسالة تجريبية" },
});
console.log("4) TEST HTTP:", th.status);
await new Promise((r) => setTimeout(r, 9000));
const { data: t2 } = await sb
  .from("test_runs")
  .select("passed,error")
  .eq("id", t!.id)
  .single();
console.log("   TEST RESULT:", JSON.stringify(t2));

if (MODE !== "run") {
  console.log("DONE (test only). للتشغيل الحقيقي: أعد التشغيل بوسيطة run");
  process.exit(0);
}

// 5) تشغيل حقيقي: موافقة → رسالة تيليجرام فعلية (بتفويض المستخدم الصريح — الرسالة تصله هو)
await sb.from("flows").update({ status: "Active" }).eq("id", FLOW_ID);
const { data: run } = await sb
  .from("runs")
  .insert({ flow_id: FLOW_ID, version, status: "running" })
  .select("id")
  .single();
const rh = await callFlowWebhook(ir.webhookPath, {
  run_token: `run:${run!.id}`,
  test_mode: false,
  input: {},
});
console.log("5) RUN HTTP:", rh.status);

let approval: Any = null;
for (let i = 0; i < 20 && !approval; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const { data: aps } = await sb
    .from("approvals")
    .select("*")
    .eq("run_id", run!.id)
    .eq("status", "pending")
    .limit(1);
  approval = aps?.[0] ?? null;
}
if (!approval) {
  console.log("!! لم يصل طلب الموافقة — افحص النفق/التبليغات");
  process.exit(1);
}
console.log("6) APPROVAL arrived:", approval.action_type);
const res = await resumeExecution(approval.resume_url, { approved: true });
console.log("   RESUME:", res.status);
await sb.from("approvals").update({ status: "approved" }).eq("id", approval.id);

for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const { data: r2 } = await sb
    .from("runs")
    .select("status,error")
    .eq("id", run!.id)
    .single();
  if (r2?.status !== "running" && r2?.status !== "waiting_approval") {
    console.log("7) FINAL RUN:", JSON.stringify(r2));
    break;
  }
}
console.log("تحقق تيليجرامك 📲");

}
main().catch((e) => { console.error(e); process.exit(1); });
