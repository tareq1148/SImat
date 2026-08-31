import { NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/server";

// يستقبل أحداث محرك التنفيذ (بدء / طلب موافقة / انتهاء) — محمي بسر مشترك
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-muhawwil-secret");
  if (secret !== (process.env.MUHAWWIL_WEBHOOK_SECRET ?? "dev-secret")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const event = (await req.json()) as {
    run_token?: string;
    event: "started" | "approval_requested" | "finished" | "execution_failed";
    execution_id?: string;
    status?: "success" | "rejected";
    output?: unknown;
    summary?: string;
    gated_step?: string;
    resume_url?: string;
    data?: unknown;
    failed_node?: string | null;
    error_message?: string;
  };

  // فشل تنفيذ داخل المحرك — يصل من معالج الأخطاء العام بلا run_token؛ نطابق بمعرف التنفيذ
  if (event.event === "execution_failed" && event.execution_id) {
    const db2 = supabaseService();
    const failMsg = `فشل عند العقدة «${event.failed_node ?? "غير معروفة"}»: ${event.error_message ?? ""}`.slice(0, 500);
    const { data: tr } = await db2
      .from("test_runs")
      .select("id, flow_id")
      .eq("n8n_execution_id", event.execution_id)
      .maybeSingle();
    if (tr) {
      await db2
        .from("test_runs")
        .update({ passed: false, failure_node: event.failed_node ?? null, error: failMsg })
        .eq("id", tr.id);
      await db2.from("flows").update({ status: "NeedsRepair" }).eq("id", tr.flow_id);
      return Response.json({ ok: true, matched: "test_run" });
    }
    const { data: rn } = await db2
      .from("runs")
      .select("id")
      .eq("n8n_execution_id", event.execution_id)
      .maybeSingle();
    if (rn) {
      await db2
        .from("runs")
        .update({ status: "error", error: failMsg, finished_at: new Date().toISOString() })
        .eq("id", rn.id);
      return Response.json({ ok: true, matched: "run" });
    }
    return Response.json({ ok: true, matched: null });
  }

  const token = event.run_token ?? "";
  const [kind, refId] = token.split(":");
  if (!kind || !refId) {
    return Response.json({ error: "bad token" }, { status: 400 });
  }

  const db = supabaseService();

  if (kind === "test") {
    const { data: testRun } = await db
      .from("test_runs")
      .select("id, flow_id, expected")
      .eq("id", refId)
      .single();
    if (!testRun) return Response.json({ error: "unknown test" }, { status: 404 });

    if (event.event === "started") {
      await db
        .from("test_runs")
        .update({ n8n_execution_id: event.execution_id ?? null })
        .eq("id", refId);
    } else if (event.event === "finished") {
      const success = event.status === "success";
      await db
        .from("test_runs")
        .update({
          actual: event.output ?? null,
          passed: success,
          error: success ? null : "أوقف التنفيذ قبل الاكتمال",
        })
        .eq("id", refId);
      await db
        .from("flows")
        .update(
          success
            ? { status: "Ready", repair_attempts: 0 }
            : { status: "NeedsRepair" }
        )
        .eq("id", testRun.flow_id);
    }
    return Response.json({ ok: true });
  }

  if (kind === "run") {
    const { data: run } = await db
      .from("runs")
      .select("id, flow_id")
      .eq("id", refId)
      .single();
    if (!run) return Response.json({ error: "unknown run" }, { status: 404 });

    if (event.event === "started") {
      await db
        .from("runs")
        .update({ n8n_execution_id: event.execution_id ?? null })
        .eq("id", refId);
    } else if (event.event === "approval_requested") {
      await db.from("approvals").insert({
        flow_id: run.flow_id,
        run_id: run.id,
        action_type: event.gated_step ?? "إجراء حساس",
        summary: event.summary ?? "",
        payload: event.data ?? null,
        resume_url: event.resume_url ?? null,
        status: "pending",
      });
      await db
        .from("runs")
        .update({ status: "waiting_approval" })
        .eq("id", refId);
    } else if (event.event === "finished") {
      await db
        .from("runs")
        .update({
          status: event.status === "rejected" ? "rejected" : "success",
          result: event.output ?? null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", refId);
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "unknown kind" }, { status: 400 });
}
