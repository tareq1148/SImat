// تكامل Gmail عبر OAuth 2.0 — المنطق المشترك بين مسار البدء ومسار العودة.

// Gmail: يُنفَّذ عبر اعتماد gmailOAuth2 في المحرك (تكامل قائم يعمل)
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

// الخدمات الخمس التي ينفّذها n8n عبر Webhook — لكلٍّ نطاقاته
export const SERVICE_SCOPES = {
  drive: [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
  ],
  sheets: ["https://www.googleapis.com/auth/spreadsheets"],
  slides: ["https://www.googleapis.com/auth/presentations"],
  calendar: ["https://www.googleapis.com/auth/calendar.events"],
  docs: ["https://www.googleapis.com/auth/documents"],
} as const;

export type GoogleService = keyof typeof SERVICE_SCOPES;

/** كل النطاقات المطلوبة — Gmail يبقى لأن تكامله قائم ويعمل */
export const ALL_SCOPES = [
  ...GMAIL_SCOPES,
  ...Object.values(SERVICE_SCOPES).flat(),
];

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** اسم كوكي حالة CSRF — يُقارَن بما يعيده جوجل في state */
export const OAUTH_STATE_COOKIE = "g_oauth_state";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** يرجع الإعداد، أو رسالة عربية دقيقة تسمّي المتغير الناقص */
export function googleConfig(): { config: GoogleConfig } | { error: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  const missing = [
    !clientId && "GOOGLE_CLIENT_ID",
    !clientSecret && "GOOGLE_CLIENT_SECRET",
    !redirectUri && "GOOGLE_REDIRECT_URI",
  ].filter(Boolean);
  if (missing.length)
    return { error: `متغيرات غير مضبوطة في .env.local: ${missing.join("، ")}` };

  // العبارة النائبة تمر كقيمة غير فارغة لكنها تُفشل تبادل التوكن برسالة غامضة من جوجل
  if (/^ضع_هنا|^your[_-]|^changeme/i.test(clientSecret!))
    return {
      error:
        "GOOGLE_CLIENT_SECRET ما زال عبارة نائبة — انسخ السر الحقيقي من Google Cloud Console.",
    };

  return { config: { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri! } };
}

/** نطاقات خدمة بعينها — أو الكل إن لم تُحدَّد */
export function scopesFor(service?: string): string[] {
  if (service === "gmail") return GMAIL_SCOPES;
  if (service && service in SERVICE_SCOPES)
    return [...SERVICE_SCOPES[service as GoogleService]];
  return ALL_SCOPES;
}

/**
 * أي الخدمات مُنحت فعلًا؟ يُقرأ من scope العائد في استجابة التوكن.
 * include_granted_scopes يجعل جوجل يراكم الأذونات، فالعائد يشمل ما سبق منحه.
 */
export function grantedServices(scope: string | undefined): GoogleService[] {
  const granted = new Set((scope ?? "").split(/\s+/).filter(Boolean));
  return (Object.keys(SERVICE_SCOPES) as GoogleService[]).filter((svc) =>
    SERVICE_SCOPES[svc].every((s) => granted.has(s))
  );
}

/** هل مُنحت نطاقات Gmail؟ */
export function gmailGranted(scope: string | undefined): boolean {
  const granted = new Set((scope ?? "").split(/\s+/).filter(Boolean));
  return GMAIL_SCOPES.every((s) => granted.has(s));
}

/** رابط شاشة موافقة جوجل — بنطاقات الخدمة المطلوبة وحدها */
export function buildConsentUrl(
  config: GoogleConfig,
  state: string,
  scopes: string[] = ALL_SCOPES
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    // offline + consent ضروريان معًا للحصول على refresh_token في كل مرة
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

/** تبادل رمز التفويض بالتوكنات */
export async function exchangeCodeForTokens(
  config: GoogleConfig,
  code: string
): Promise<{ tokens: GoogleTokens } | { error: string }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    // خطأ جوجل يأتي JSON فيه error و error_description — نترجمه لرسالة مفيدة
    let detail = text.slice(0, 200);
    try {
      const j = JSON.parse(text) as { error?: string; error_description?: string };
      if (j.error === "redirect_uri_mismatch")
        detail = "رابط العودة لا يطابق المسجَّل في Google Cloud Console";
      else if (j.error === "invalid_client")
        detail = "معرّف العميل أو سرّه غير صحيح";
      else detail = j.error_description ?? j.error ?? detail;
    } catch {}
    return { error: `تعذر تبادل رمز جوجل (${res.status}): ${detail}` };
  }

  return { tokens: JSON.parse(text) as GoogleTokens };
}

/** فشل التجديد الذي لا يُصلحه إلا ربط جديد من المستخدم */
export class RefreshRevokedError extends Error {}

/**
 * تجديد access_token من refresh_token.
 * يرمي RefreshRevokedError عند invalid_grant — أي أن refresh_token نفسه انتهى
 * أو سُحب الإذن (وضع Testing في جوجل يُنهيه بعد ٧ أيام).
 */
export async function refreshAccessToken(
  config: GoogleConfig,
  refreshToken: string
): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    let code = "";
    let desc = text.slice(0, 200);
    try {
      const j = JSON.parse(text) as { error?: string; error_description?: string };
      code = j.error ?? "";
      desc = j.error_description ?? (code || desc);
    } catch {}
    if (code === "invalid_grant") {
      throw new RefreshRevokedError(
        "انتهت صلاحية ربط Gmail أو سُحب الإذن — أعد الربط. " +
          "(في وضع Testing لدى جوجل ينتهي التوكن بعد ٧ أيام)"
      );
    }
    throw new Error(`تعذر تجديد توكن جوجل (${res.status}): ${desc}`);
  }

  // استجابة التجديد لا تحمل refresh_token جديدًا — المحفوظ يبقى صالحًا
  return JSON.parse(text) as GoogleTokens;
}
