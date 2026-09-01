import { supabaseServer, supabaseService } from "@/lib/supabase/server";

// حالة ربط Gmail — يرجع الحقول غير الحسّاسة فقط، ولا يمرّ أي توكن للعميل
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  let db;
  try {
    db = supabaseService();
  } catch {
    // مفتاح الخدمة غير مضبوط — نعتبرها غير متصلة بدل إسقاط الواجهة
    return Response.json({ connected: false });
  }

  const { data, error } = await db
    .from("oauth_tokens")
    .select("scope, expires_at, updated_at, refresh_token")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();

  if (error || !data) return Response.json({ connected: false });

  return Response.json({
    connected: true,
    // نرسل وجود التوكن لا قيمته
    has_refresh_token: Boolean(data.refresh_token),
    scope: data.scope ?? null,
    expires_at: data.expires_at ?? null,
    connected_at: data.updated_at ?? null,
  });
}

// فصل الربط — يحذف التوكنات المخزّنة
export async function DELETE() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  try {
    const db = supabaseService();
    await db
      .from("oauth_tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "google");
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "تعذر الفصل" },
      { status: 500 }
    );
  }

  return Response.json({ connected: false });
}
