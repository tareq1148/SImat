import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { getValidGoogleAccessToken } from "@/lib/google-tokens";
import { revokeGmailCredential } from "@/lib/gmail-n8n";

// حالة ربط Gmail — يجدّد التوكن إن لزم، ولا يمرّر أي توكن للعميل
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const result = await getValidGoogleAccessToken(user.id);

  if (result.ok) {
    // نرسل واقعة التجديد لا التوكن نفسه
    return Response.json({ connected: true, needs_reauth: false, refreshed: result.refreshed });
  }
  if (result.reason === "needs_reauth") {
    return Response.json({
      connected: true,
      needs_reauth: true,
      error: result.error ?? "انتهت صلاحية الربط — أعد الربط",
    });
  }
  if (result.reason === "error") {
    // إعداد ناقص أو جدول مفقود: نعتبرها غير متصلة بدل إسقاط الواجهة
    return Response.json({ connected: false, error: result.error });
  }
  return Response.json({ connected: false });
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

    // نقرأ معرّف الاعتماد قبل حذف الصف، وإلا بقي اعتماد يتيم في المحرك
    const { data: row } = await db
      .from("oauth_tokens")
      .select("n8n_credential_id")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle<{ n8n_credential_id: string | null }>();

    await revokeGmailCredential(db, user.id, row?.n8n_credential_id ?? null);

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
