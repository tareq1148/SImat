// الحلقة الواصلة: توكنات جوجل المحفوظة عندنا ← اعتماد gmailOAuth2 داخل محرّك n8n.
//
// n8n لا يحتاج أن يجري دورة موافقة خاصة به: مخطط اعتماد gmailOAuth2 يقبل
// clientId وclientSecret وoauthTokenData، فنحقن التوكن الذي حصلنا عليه مباشرة.
// بعدها يلتقط المحوّل (adapter) المعرّف من جدول connections ويبني المسار
// بحساب المستخدم بدل حساب المنصة.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createN8nCredential,
  deleteN8nCredential,
  hasN8nKey,
} from "./n8n";
import type { GoogleTokens } from "./google-oauth";

/**
 * شكل oauthTokenData الذي يتوقعه n8n: استجابة توكن OAuth2 الخام.
 * expiry_date (ميلي ثانية) هو ما يعتمد عليه n8n لمعرفة وقت التجديد.
 */
function toOAuthTokenData(tokens: GoogleTokens, refreshToken: string) {
  return {
    access_token: tokens.access_token,
    refresh_token: refreshToken,
    scope: tokens.scope ?? "",
    token_type: tokens.token_type ?? "Bearer",
    ...(tokens.expires_in
      ? {
          expires_in: tokens.expires_in,
          expiry_date: Date.now() + tokens.expires_in * 1000,
        }
      : {}),
  };
}

export interface SyncResult {
  ok: boolean;
  credentialId?: string;
  error?: string;
}

/**
 * ينشئ اعتماد Gmail في n8n من التوكنات ويربطه بالمستخدم في جدول connections.
 * يستبدل أي اعتماد سابق (لا واجهة تحديث للاعتمادات في n8n العام — نحذف وننشئ).
 */
export async function syncGmailCredential(
  db: SupabaseClient,
  userId: string,
  tokens: GoogleTokens,
  refreshToken: string,
  previousCredentialId: string | null
): Promise<SyncResult> {
  if (!hasN8nKey()) {
    return { ok: false, error: "N8N_API_KEY غير مضبوط — لن يُنشأ اعتماد في المحرك" };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, error: "بيانات عميل جوجل ناقصة" };
  }

  // الاعتماد القديم يُحذف أولًا حتى لا تتراكم اعتمادات ميتة في المحرك
  if (previousCredentialId) {
    try {
      await deleteN8nCredential(previousCredentialId);
    } catch {
      // فشل الحذف لا يمنع إنشاء الجديد — نتركه ونكمل
    }
  }

  let credentialId: string;
  try {
    const cred = await createN8nCredential(
      `muhawwil-gmail-${userId.slice(0, 8)}`,
      "gmailOAuth2",
      {
        clientId,
        clientSecret,
        oauthTokenData: toOAuthTokenData(tokens, refreshToken),
      }
    );
    credentialId = cred.id;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذر إنشاء الاعتماد في المحرك",
    };
  }

  // ربط الاعتماد بالمستخدم — من هنا يلتقطه المحوّل عند البناء
  const { error } = await db.from("connections").upsert(
    {
      user_id: userId,
      provider: "gmail",
      label: "Gmail (حسابك)",
      n8n_credential_id: credentialId,
      status: "connected",
      metadata: { source: "user" },
    },
    { onConflict: "user_id,provider" }
  );
  if (error) return { ok: false, credentialId, error: error.message };

  return { ok: true, credentialId };
}

/** فصل الربط: حذف الاعتماد من المحرك وإلغاء صف الاتصال */
export async function revokeGmailCredential(
  db: SupabaseClient,
  userId: string,
  credentialId: string | null
): Promise<void> {
  if (credentialId && hasN8nKey()) {
    try {
      await deleteN8nCredential(credentialId);
    } catch {
      // الاعتماد قد يكون حُذف يدويًا من المحرك — لا يغيّر النتيجة
    }
  }
  await db
    .from("connections")
    .update({ status: "revoked", n8n_credential_id: null })
    .eq("user_id", userId)
    .eq("provider", "gmail");
}
