import { supabaseServer } from "@/lib/supabase/server";

// تقارير النجاح والوقت الموفَّر (PRD — المرحلة التالية)
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const [{ data: flows }, { data: runs }, { data: tests }] = await Promise.all([
    supabase
      .from("flows")
      .select("id, name, status, manual_minutes_per_run"),
    supabase
      .from("runs")
      .select("flow_id, status, started_at"),
    supabase.from("test_runs").select("flow_id, passed"),
  ]);

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const perFlow = (flows ?? []).map((f) => {
    const fr = (runs ?? []).filter((r) => r.flow_id === f.id);
    const success = fr.filter((r) => r.status === "success").length;
    const failed = fr.filter((r) => r.status === "error").length;
    const rejected = fr.filter((r) => r.status === "rejected").length;
    const week = fr.filter(
      (r) => new Date(r.started_at).getTime() > weekAgo
    ).length;
    const ft = (tests ?? []).filter((t) => t.flow_id === f.id);
    const minutes = f.manual_minutes_per_run ?? 15;
    return {
      flow_id: f.id,
      name: f.name,
      status: f.status,
      runs_total: fr.length,
      runs_success: success,
      runs_failed: failed,
      runs_rejected: rejected,
      runs_last7d: week,
      success_rate: fr.length ? Math.round((success / fr.length) * 100) : null,
      tests_total: ft.length,
      tests_passed: ft.filter((t) => t.passed === true).length,
      manual_minutes_per_run: f.manual_minutes_per_run,
      minutes_saved: success * minutes,
    };
  });

  const totals = {
    flows: perFlow.length,
    active: (flows ?? []).filter((f) => f.status === "Active").length,
    runs_success: perFlow.reduce((s, f) => s + f.runs_success, 0),
    runs_total: perFlow.reduce((s, f) => s + f.runs_total, 0),
    minutes_saved: perFlow.reduce((s, f) => s + f.minutes_saved, 0),
  };

  return Response.json({ totals, flows: perFlow });
}
