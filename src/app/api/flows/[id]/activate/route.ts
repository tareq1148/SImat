import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { activateWorkflow, deactivateWorkflow, hasN8nKey } from "@/lib/n8n";

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

  const { action } = (await req.json()) as { action: "activate" | "pause" };

  const { data: flow } = await supabase
    .from("flows")
    .select("id, status, n8n_workflow_id")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });

  const engine = flow.n8n_workflow_id && hasN8nKey() ? flow.n8n_workflow_id : null;

  if (action === "activate") {
    // البناء شرط التفعيل لا الاختبار: الخطوات الحسّاسة تظلّ موقوفة على موافقة
    // المستخدم وقت التنفيذ، فلا يفلت إرسالٌ لمجرّد أن المسار فُعِّل بلا اختبار.
    const READY_TO_ACTIVATE = ["ReadyToTest", "Ready", "Paused", "NeedsRepair"];
    if (!READY_TO_ACTIVATE.includes(flow.status)) {
      return Response.json(
        { error: "ابنِ المسار أولًا — لم يُنشأ في المحرك بعد" },
        { status: 400 }
      );
    }
    // المحرّك أوّلًا ثم الحالة: لو انعكس الترتيب لقالت القاعدة «مفعّل» ومؤقّته
    // لم يُسلَّح، فيعِد المستخدمَ بعملٍ لا يجري
    if (engine) {
      try {
        await activateWorkflow(engine);
      } catch {
        return Response.json(
          { error: "تعذّر تفعيل المسار في المحرك — حاول مرة أخرى" },
          { status: 502 }
        );
      }
    }
    await supabase.from("flows").update({ status: "Active" }).eq("id", id);
    return Response.json({ status: "Active" });
  }

  // الإيقاف يُطفئ المؤقّت في المحرك قبل أن تُكتب الحالة. وإن تعذّر الإطفاء
  // لم تُكتب: حالةٌ تقول «موقوف» ومؤقّتٌ يرسل أسوأ من إقرارٍ بالفشل.
  if (engine) {
    try {
      await deactivateWorkflow(engine);
    } catch {
      return Response.json(
        { error: "تعذّر إيقاف المسار في المحرك — ما زال يعمل، حاول مرة أخرى" },
        { status: 502 }
      );
    }
  }
  await supabase.from("flows").update({ status: "Paused" }).eq("id", id);
  return Response.json({ status: "Paused" });
}
