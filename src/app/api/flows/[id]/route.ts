import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { deactivateWorkflow, deleteWorkflow, hasN8nKey } from "@/lib/n8n";

// إعادة تسمية المسار وحذفه — يُستدعيان من قائمة النقاط الثلاث في الشريط الجانبي.
// كل استعلام مقيّد بـ user_id إضافةً إلى RLS: حزامان لا حزام واحد.

const MAX_NAME = 120;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "الاسم مطلوب" }, { status: 400 });
  if (name.length > MAX_NAME) {
    return Response.json(
      { error: `الاسم أطول من ${MAX_NAME} حرفًا` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("flows")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "المسار غير موجود" }, { status: 404 });

  return Response.json({ ok: true, name: data.name });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { data: flow, error: readErr } = await supabase
    .from("flows")
    .select("id, n8n_workflow_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr) return Response.json({ error: readErr.message }, { status: 500 });
  if (!flow) return Response.json({ error: "المسار غير موجود" }, { status: 404 });

  // أوقف سير العمل في المحرك ثم احذفه — بذل جهد لا شرط نجاح:
  // فشل المحرك يجب ألا يمنع المستخدم من حذف مساره من المنصّة.
  let engineWarning: string | null = null;
  if (flow.n8n_workflow_id && hasN8nKey()) {
    try {
      await deactivateWorkflow(flow.n8n_workflow_id);
    } catch {
      // قد يكون متوقفًا أصلًا
    }
    try {
      await deleteWorkflow(flow.n8n_workflow_id);
    } catch {
      engineWarning = "حُذف المسار من المنصّة، لكن تعذّر حذفه من المحرك — احذفه يدويًا من n8n.";
    }
  }

  // الجداول التابعة (الإصدارات، التشغيلات، الموافقات، التجارب) تُحذف بالتتالي
  const { error: delErr } = await supabase
    .from("flows")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

  return Response.json({ ok: true, warning: engineWarning });
}
