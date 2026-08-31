import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { resumeExecution } from "@/lib/n8n";

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

  const { decision } = (await req.json()) as {
    decision: "approved" | "rejected";
  };

  const { data: approval } = await supabase
    .from("approvals")
    .select("*")
    .eq("id", id)
    .single();
  if (!approval)
    return Response.json({ error: "طلب الموافقة غير موجود" }, { status: 404 });
  if (approval.status !== "pending")
    return Response.json({ error: "تم البت في هذا الطلب مسبقًا" }, { status: 400 });

  if (approval.resume_url) {
    const res = await resumeExecution(approval.resume_url, {
      approved: decision === "approved",
    });
    if (!res.ok) {
      return Response.json(
        { error: `تعذر استئناف التنفيذ (${res.status}) — ربما انتهت مهلة الانتظار` },
        { status: 502 }
      );
    }
  }

  await supabase
    .from("approvals")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", id);

  if (approval.run_id) {
    await supabase
      .from("runs")
      .update({ status: decision === "approved" ? "running" : "rejected" })
      .eq("id", approval.run_id);
  }

  return Response.json({ ok: true, decision });
}
