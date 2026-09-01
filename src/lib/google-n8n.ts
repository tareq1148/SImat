// اعتمادات جوجل الخمس داخل محرّك n8n — نفس نهج Gmail.
//
// المحرّك لا يجري دورة موافقة خاصة به: مخططات googleXxxOAuth2Api تقبل
// clientId وclientSecret وoauthTokenData، فنحقن التوكن الذي حصلنا عليه من
// شاشة موافقة واحدة. بعدها تنفّذ عقد جوجل في المحرّك بحساب المستخدم نفسه،
// بلا تمرير توكن في حمولة الـWebhook.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createN8nCredential, deleteN8nCredential, hasN8nKey } from "./n8n";
import type { GoogleService, GoogleTokens } from "./google-oauth";
import { SERVICE_SCOPES } from "./google-oauth";

/** نوع الاعتماد في n8n لكل خدمة */
export const CREDENTIAL_TYPES: Record<GoogleService, string> = {
  drive: "googleDriveOAuth2Api",
  sheets: "googleSheetsOAuth2Api",
  slides: "googleSlidesOAuth2Api",
  calendar: "googleCalendarOAuth2Api",
  docs: "googleDocsOAuth2Api",
};

export const SERVICES = Object.keys(CREDENTIAL_TYPES) as GoogleService[];

/** اسم المزوّد في جدول connections — drive/sheets يطابقان أسماء قائمة أصلًا */
const PROVIDER_OF: Record<GoogleService, string> = {
  drive: "google_drive",
  sheets: "google_sheets",
  slides: "google_slides",
  calendar: "google_calendar",
  docs: "google_docs",
};

const LABEL_OF: Record<GoogleService, string> = {
  drive: "Google Drive (حسابك)",
  sheets: "Google Sheets (حسابك)",
  slides: "Google Slides (حسابك)",
  calendar: "Google Calendar (حسابك)",
  docs: "Google Docs (حسابك)",
};

/**
 * oauthTokenData كما يتوقعه n8n: استجابة توكن OAuth2 الخام.
 * expiry_date (ميلي ثانية) هو ما يعتمد عليه المحرّك ليعرف وقت التجديد.
 * scope يُقصر على نطاقات الخدمة كي لا يحمل كل اعتماد صلاحيات لا يحتاجها.
 */
function tokenDataFor(
  service: GoogleService,
  tokens: GoogleTokens,
  refreshToken: string
) {
  return {
    access_token: tokens.access_token,
    refresh_token: refreshToken,
    scope: SERVICE_SCOPES[service].join(" "),
    token_type: tokens.token_type ?? "Bearer",
    ...(tokens.expires_in
      ? {
          expires_in: tokens.expires_in,
          expiry_date: Date.now() + tokens.expires_in * 1000,
        }
      : {}),
  };
}

export interface ServiceSyncResult {
  service: GoogleService;
  ok: boolean;
  credentialId?: string;
  error?: string;
}

/**
 * ينشئ اعتمادات الخدمات الخمس في المحرّك ويربطها بالمستخدم.
 * يستبدل أي اعتماد سابق (لا واجهة تحديث للاعتمادات في n8n العام).
 * لا يرمي: كل خدمة تعود بنتيجتها فيبقى نجاح البعض قائمًا رغم فشل غيره.
 */
export async function syncGoogleServiceCredentials(
  db: SupabaseClient,
  userId: string,
  tokens: GoogleTokens,
  refreshToken: string,
  previous: Partial<Record<GoogleService, string | null>> = {},
  /** الخدمات المُنح إذنها — لا نُنشئ اعتمادًا لخدمة بلا نطاق */
  only: GoogleService[] = SERVICES
): Promise<ServiceSyncResult[]> {
  if (only.length === 0) return [];
  if (!hasN8nKey())
    return only.map((service) => ({
      service,
      ok: false,
      error: "N8N_API_KEY غير مضبوط",
    }));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return only.map((service) => ({
      service,
      ok: false,
      error: "بيانات عميل جوجل ناقصة",
    }));

  const results: ServiceSyncResult[] = [];

  for (const service of only) {
    // القديم يُحذف أولًا كي لا تتراكم اعتمادات ميتة في المحرّك
    const old = previous[service];
    if (old) {
      try {
        await deleteN8nCredential(old);
      } catch {
        // فشل الحذف لا يمنع إنشاء الجديد
      }
    }

    try {
      const cred = await createN8nCredential(
        `muhawwil-${service}-${userId.slice(0, 8)}`,
        CREDENTIAL_TYPES[service],
        {
          clientId,
          clientSecret,
          oauthTokenData: tokenDataFor(service, tokens, refreshToken),
        }
      );

      const { error } = await db.from("connections").upsert(
        {
          user_id: userId,
          provider: PROVIDER_OF[service],
          label: LABEL_OF[service],
          n8n_credential_id: cred.id,
          status: "connected",
          metadata: { source: "user", service },
        },
        { onConflict: "user_id,provider" }
      );

      if (error) {
        // الاعتماد أُنشئ لكن ربطه فشل — نحذفه كي لا يبقى يتيمًا في المحرّك
        try {
          await deleteN8nCredential(cred.id);
        } catch {
          // الحذف أفضل جهد؛ الفشل يُبلَّغ للمستدعي على أي حال
        }
        results.push({ service, ok: false, error: `تعذّر ربط ${service}: ${error.message}` });
      } else {
        results.push({ service, ok: true, credentialId: cred.id });
      }
    } catch (err) {
      results.push({
        service,
        ok: false,
        error: err instanceof Error ? err.message : "تعذّر إنشاء الاعتماد",
      });
    }
  }

  return results;
}

/** فصل الربط: حذف اعتمادات الخدمات من المحرّك وإلغاء صفوفها */
export async function revokeGoogleServiceCredentials(
  db: SupabaseClient,
  userId: string,
  credentialIds: Partial<Record<GoogleService, string | null>>
): Promise<void> {
  if (hasN8nKey()) {
    for (const service of SERVICES) {
      const id = credentialIds[service];
      if (!id) continue;
      try {
        await deleteN8nCredential(id);
      } catch {
        // قد يكون حُذف يدويًا من المحرّك — لا يغيّر النتيجة
      }
    }
  }
  await db
    .from("connections")
    .update({ status: "revoked", n8n_credential_id: null })
    .eq("user_id", userId)
    .in("provider", SERVICES.map((s) => PROVIDER_OF[s]));
}
