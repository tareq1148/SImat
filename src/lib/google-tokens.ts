// الوصول إلى توكن جوجل من الخادم — يجدّد تلقائيًا عند الحاجة.
// كل استدعاء لـGmail يمرّ من هنا حتى لا يتكرر منطق التجديد.

import { supabaseService } from "./supabase/server";
import {
  RefreshRevokedError,
  googleConfig,
  refreshAccessToken,
} from "./google-oauth";

/** هامش أمان: نجدّد قبل الانتهاء بدقيقتين حتى لا ينتهي التوكن أثناء الطلب */
const RENEW_MARGIN_MS = 120_000;

export interface TokenRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  needs_reauth: boolean | null;
  updated_at: string | null;
}

export type TokenResult =
  | { ok: true; accessToken: string; refreshed: boolean }
  | { ok: false; reason: "not_connected" | "needs_reauth" | "error"; error?: string };

/** هل انتهى التوكن أو أوشك؟ */
export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true; // بلا تاريخ لا نفترض الصلاحية
  return new Date(expiresAt).getTime() - Date.now() <= RENEW_MARGIN_MS;
}

/** يسجّل أن الربط يحتاج تجديدًا يدويًا من المستخدم */
async function markNeedsReauth(userId: string, message: string) {
  try {
    await supabaseService()
      .from("oauth_tokens")
      .update({
        needs_reauth: true,
        last_error: message.slice(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "google");
  } catch {
    // فشل التسجيل لا يغيّر النتيجة المعادة للمستدعي
  }
}

/**
 * يرجع access_token صالحًا للمستخدم، مجدِّدًا إياه إن لزم.
 * لا يرمي: كل الحالات تعود كنتيجة موصوفة ليقرر المستدعي.
 */
export async function getValidGoogleAccessToken(
  userId: string
): Promise<TokenResult> {
  const cfg = googleConfig();
  if ("error" in cfg) return { ok: false, reason: "error", error: cfg.error };

  let db;
  try {
    db = supabaseService();
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : "تعذر الوصول للتخزين",
    };
  }

  const { data, error } = await db
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at, scope, needs_reauth, updated_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle<TokenRow>();

  if (error) return { ok: false, reason: "error", error: error.message };
  if (!data) return { ok: false, reason: "not_connected" };
  if (data.needs_reauth) return { ok: false, reason: "needs_reauth" };

  // التوكن الحالي ما زال صالحًا
  if (data.access_token && !isExpired(data.expires_at)) {
    return { ok: true, accessToken: data.access_token, refreshed: false };
  }

  if (!data.refresh_token) {
    await markNeedsReauth(userId, "لا يوجد refresh_token محفوظ");
    return { ok: false, reason: "needs_reauth" };
  }

  try {
    const fresh = await refreshAccessToken(cfg.config, data.refresh_token);
    const expiresAt = fresh.expires_in
      ? new Date(Date.now() + fresh.expires_in * 1000).toISOString()
      : null;

    await db
      .from("oauth_tokens")
      .update({
        access_token: fresh.access_token,
        expires_at: expiresAt,
        scope: fresh.scope ?? data.scope,
        needs_reauth: false,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "google");

    return { ok: true, accessToken: fresh.access_token, refreshed: true };
  } catch (err) {
    if (err instanceof RefreshRevokedError) {
      await markNeedsReauth(userId, err.message);
      return { ok: false, reason: "needs_reauth", error: err.message };
    }
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : "تعذر التجديد",
    };
  }
}
