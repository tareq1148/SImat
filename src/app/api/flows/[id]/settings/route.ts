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

  const body = (await req.json()) as { manual_minutes_per_run?: number };
  const minutes = Number(body.manual_minutes_per_run);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 100000) {
    return Response.json({ error: "قيمة دقائق غير صالحة" }, { status: 400 });
  }

  const { error } = await supabase
    .from("flows")
    .update({ manual_minutes_per_run: Math.round(minutes) })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, manual_minutes_per_run: Math.round(minutes) });
}
