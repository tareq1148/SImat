import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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
    .select("id, status")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });

  if (action === "activate") {
    if (flow.status !== "Ready" && flow.status !== "Paused") {
      return Response.json(
        { error: "لا يمكن التفعيل قبل نجاح الاختبار (الحالة: Ready)" },
        { status: 400 }
      );
    }
    await supabase.from("flows").update({ status: "Active" }).eq("id", id);
    return Response.json({ status: "Active" });
  }

  await supabase.from("flows").update({ status: "Paused" }).eq("id", id);
  return Response.json({ status: "Paused" });
}
