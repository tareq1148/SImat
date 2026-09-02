// التقاط معرّف محادثة تيليجرام بعد الربط.
//
// المستخدم يعطي توكن البوت، ومعرّف المحادثة لا يُعرف إلا بعد أن يراسل البوت.
// فإن ربط قبل أن يرسل /start ضاع المعرّف، ولا سبيل لاستعادته لأن التوكن يذهب
// إلى المحرّك ولا يُحفظ عندنا. فنحفظه في oauth_tokens (خدمةٌ فقط، لا يقرؤه
// المستخدم) لنلتقط المعرّف لاحقًا بلا مطالبته بإعادة إدخال التوكن.

import { supabaseService } from "./supabase/server";

/** يحفظ توكن البوت في الجدول المقفل — ليُستعمل في التقاط المعرّف لاحقًا */
export async function storeTelegramToken(
  userId: string,
  token: string
): Promise<void> {
  try {
    await supabaseService()
      .from("oauth_tokens")
      .upsert(
        {
          user_id: userId,
          provider: "telegram",
          access_token: token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );
  } catch {
    // فشل الحفظ لا يمنع الربط — يبقى المستخدم قادرًا على إعادة الإدخال
  }
}

/** أحدث معرّف محادثة راسلت البوت — أو null إن لم يراسله أحد بعد */
export async function resolveTelegramChatId(
  userId: string
): Promise<string | null> {
  try {
    const { data } = await supabaseService()
      .from("oauth_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provider", "telegram")
      .maybeSingle();

    const token = (data as { access_token?: string } | null)?.access_token;
    if (!token) return null;

    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=20`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: { message?: { chat?: { id?: number } } }[];
    };
    const last = (json.result ?? [])
      .map((u) => u.message?.chat?.id)
      .filter((id): id is number => typeof id === "number")
      .pop();
    return last ? String(last) : null;
  } catch {
    return null;
  }
}
