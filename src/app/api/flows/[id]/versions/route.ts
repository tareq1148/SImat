import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { publishNewVersion } from "@/lib/versioning";
import type { TaskSpec } from "@/lib/types";

// سجل الإصدارات + الاسترجاع (PRD 10.10)
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

  const [{ data: flow }, { data: versions }] = await Promise.all([
    supabase.from("flows").select("current_version").eq("id", id).single(),
    supabase
      .from("flow_versions")
      .select("version, note, created_at")
      .eq("flow_id", id)
      .order("version", { ascending: false })
      .limit(20),
  ]);

  return Response.json({
    current: flow?.current_version ?? 0,
    versions: versions ?? [],
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { version } = (await req.json()) as { version: number };

  const [{ data: flow }, { data: target }] = await Promise.all([
    supabase
      .from("flows")
      .select("id, task_spec_id, current_version")
      .eq("id", id)
      .single(),
    supabase
      .from("flow_versions")
      .select("version, spec")
      .eq("flow_id", id)
      .eq("version", version)
      .maybeSingle(),
  ]);
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });
  if (!target?.spec)
    return Response.json(
      { error: "هذا الإصدار قديم ولا يحمل لقطة مواصفة قابلة للاسترجاع" },
      { status: 400 }
    );

  const restored = await publishNewVersion(
    supabase,
    { id: flow.id, task_spec_id: flow.task_spec_id, current_version: flow.current_version },
    target.spec as TaskSpec,
    `استرجاع الإصدار ${version}`
  );
  await supabase.from("flows").update({ repair_attempts: 0 }).eq("id", id);

  return Response.json({ restoredFrom: version, newVersion: restored.version });
}
