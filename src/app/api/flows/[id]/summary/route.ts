import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { buildUiSummary } from "@/lib/summary";
import { activeConnections } from "@/lib/connections";
import type { ConnectionRow, FlowRow, TaskSpec, WorkflowIR } from "@/lib/types";

export async function GET(
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
    .select("*, task_specs(full_spec)")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });

  const [{ data: versionRow }, { data: conns }] = await Promise.all([
    supabase
      .from("flow_versions")
      .select("ir")
      .eq("flow_id", id)
      .eq("version", flow.current_version)
      .maybeSingle(),
    supabase
      .from("connections")
      .select("id, provider, label, status, n8n_credential_id, metadata")
      .eq("status", "connected"),
  ]);

  const spec =
    (flow.task_specs as { full_spec: TaskSpec | null } | null)?.full_spec ?? null;

  return Response.json(
    buildUiSummary(
      flow as FlowRow,
      (versionRow?.ir as WorkflowIR) ?? null,
      spec,
      activeConnections(conns) as ConnectionRow[]
    )
  );
}
