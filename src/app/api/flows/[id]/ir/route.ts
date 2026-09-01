import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { WorkflowIR } from "@/lib/types";

// رسم المسار الحالي — لعرضه في شاشة «سير العمل»
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
    .select("id, name, status, current_version")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "غير موجود" }, { status: 404 });

  const { data: versionRow } = await supabase
    .from("flow_versions")
    .select("ir")
    .eq("flow_id", id)
    .eq("version", flow.current_version)
    .maybeSingle();

  return Response.json({
    id: flow.id,
    name: flow.name,
    status: flow.status,
    ir: (versionRow?.ir as WorkflowIR) ?? null,
  });
}
