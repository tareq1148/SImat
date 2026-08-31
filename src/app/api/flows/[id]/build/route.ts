import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { irToN8n, missingProviders, type CredentialMap } from "@/lib/adapter";
import {
  activateWorkflow,
  createWorkflow,
  hasN8nKey,
  updateWorkflow,
} from "@/lib/n8n";
import type { Provider, WorkflowIR } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });

  const { data: versionRow } = await supabase
    .from("flow_versions")
    .select("*")
    .eq("flow_id", id)
    .eq("version", flow.current_version)
    .single();
  if (!versionRow)
    return Response.json({ error: "لا يوجد إصدار للبناء" }, { status: 400 });

  const ir = versionRow.ir as WorkflowIR;

  // الاتصالات المطلوبة
  const { data: conns } = await supabase
    .from("connections")
    .select("provider, label, n8n_credential_id")
    .eq("status", "connected");

  const credMap: CredentialMap = {};
  (conns ?? []).forEach((c) => {
    if (c.n8n_credential_id) {
      credMap[c.provider as Provider] = {
        id: c.n8n_credential_id,
        name: c.label,
      };
    }
  });

  const missing = missingProviders(ir, credMap);
  if (missing.length > 0) {
    await supabase
      .from("flows")
      .update({ status: "NeedsConnections" })
      .eq("id", id);
    return Response.json({ status: "NeedsConnections", missing });
  }

  if (!hasN8nKey()) {
    return Response.json(
      {
        error:
          "مفتاح محرك التنفيذ غير مضبوط (N8N_API_KEY في .env.local) — لا يمكن إنشاء سير العمل.",
      },
      { status: 500 }
    );
  }

  const payload = irToN8n(ir, credMap);

  let n8nId = flow.n8n_workflow_id as string | null;
  try {
    if (n8nId) {
      await updateWorkflow(n8nId, payload);
    } else {
      const created = await createWorkflow(payload);
      n8nId = created.id;
      // نحفظ المعرف فورًا حتى لا تتكرر النسخ لو فشل التفعيل
      await supabase.from("flows").update({ n8n_workflow_id: n8nId }).eq("id", id);
    }
    await supabase
      .from("flow_versions")
      .update({ n8n_payload: payload })
      .eq("id", versionRow.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return Response.json({ error: msg }, { status: 502 });
  }

  try {
    await activateWorkflow(n8nId);
  } catch (err) {
    // فشل التفعيل غالبًا = معلومات ناقصة في عقدة (PRD 10.7: نحدد العقدة والحقل)
    const raw = err instanceof Error ? err.message : "";
    const nodeMatch = raw.match(/Node "([^"]+)"/);
    const paramMatch = raw.match(/parameters?: ([\w,\s]+)/);
    await supabase
      .from("flows")
      .update({ status: "NeedsInformation" })
      .eq("id", id);
    return Response.json({
      status: "NeedsInformation",
      node: nodeMatch?.[1] ?? null,
      missing_params: paramMatch?.[1]?.trim() ?? null,
      detail: raw.slice(0, 300),
    });
  }

  await supabase
    .from("flows")
    .update({ n8n_workflow_id: n8nId, status: "ReadyToTest" })
    .eq("id", id);

  return Response.json({ status: "ReadyToTest", n8n_workflow_id: n8nId });
}
