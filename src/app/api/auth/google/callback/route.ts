import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import {
  OAUTH_STATE_COOKIE,
  exchangeCodeForTokens,
  googleConfig,
} from "@/lib/google-oauth";
import { syncGmailCredential } from "@/lib/gmail-n8n";
import { syncGoogleServiceCredentials } from "@/lib/google-n8n";
import type { GoogleService } from "@/lib/google-oauth";

function back(origin: string, params: Record<string, string>) {
  const url = new URL("/chat", origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = NextResponse.redirect(url);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

// عودة جوجل — يبادل الرمز بالتوكنات ويحفظها للمستخدم الحالي
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) {
    return back(origin, {
      gmail_error:
        denied === "access_denied" ? "أُلغيت الموافقة على ربط Gmail" : denied,
    });
  }
  if (!code) return back(origin, { gmail_error: "لم يصل رمز التفويض من جوجل" });

  // تحقق CSRF: state العائد يجب أن يطابق الكوكي الذي كتبناه عند البدء
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!expected || !state || state !== expected) {
    return back(origin, { gmail_error: "طلب ربط غير صالح — أعد المحاولة" });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const cfg = googleConfig();
  if ("error" in cfg) return back(origin, { gmail_error: cfg.error });

  const result = await exchangeCodeForTokens(cfg.config, code);
  if ("error" in result) return back(origin, { gmail_error: result.error });
  const tokens = result.tokens;

  // التوكنات تُكتب بمفتاح الخدمة في جدول بلا سياسات RLS — لا يبلغها العميل أبدًا
  let db;
  try {
    db = supabaseService();
  } catch (err) {
    return back(origin, {
      gmail_error: err instanceof Error ? err.message : "تعذر الوصول للتخزين",
    });
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  // الصف السابق: نحتاج refresh_token المحفوظ (جوجل قد لا يعيده) ومعرّف الاعتماد القديم
  const { data: prev } = await db
    .from("oauth_tokens")
    .select("refresh_token, n8n_credential_id, service_credentials")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle<{
      refresh_token: string | null;
      n8n_credential_id: string | null;
      service_credentials: Partial<Record<GoogleService, string | null>> | null;
    }>();

  const { error } = await db.from("oauth_tokens").upsert(
    {
      user_id: user.id,
      provider: "google",
      access_token: tokens.access_token,
      // جوجل لا يعيد refresh_token إن كان ممنوحًا سابقًا — لا نمسح المحفوظ بقيمة فارغة
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
      expires_at: expiresAt,
      // ربط ناجح يمسح أي حالة «يحتاج إعادة ربط» سابقة
      needs_reauth: false,
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) {
    const hint = /relation .* does not exist/i.test(error.message)
      ? "جدول oauth_tokens غير موجود — نفّذ supabase/migrations/0001_oauth_tokens.sql"
      : error.message;
    return back(origin, { gmail_error: hint });
  }

  // الحلقة الواصلة: اعتماد gmailOAuth2 في المحرك حتى تُبنى المسارات بحساب المستخدم
  const refreshToken = tokens.refresh_token ?? prev?.refresh_token ?? null;
  if (!refreshToken) {
    // بلا refresh_token لن يستطيع n8n التجديد — الربط محفوظ لكن الأتمتة لن تدوم
    return back(origin, {
      gmail_connected: "true",
      gmail_error:
        "لم يُعِد جوجل refresh_token — افصل الربط من myaccount.google.com/permissions ثم أعد المحاولة.",
    });
  }

  const sync = await syncGmailCredential(
    db,
    user.id,
    tokens,
    refreshToken,
    prev?.n8n_credential_id ?? null
  );

  // الخدمات الخمس: اعتماد لكل واحدة من نفس التوكن — بنفس نهج Gmail
  const serviceResults = await syncGoogleServiceCredentials(
    db,
    user.id,
    tokens,
    refreshToken,
    prev?.service_credentials ?? {}
  );
  const serviceCreds = Object.fromEntries(
    serviceResults.filter((r) => r.credentialId).map((r) => [r.service, r.credentialId])
  );

  if (sync.credentialId || Object.keys(serviceCreds).length) {
    await db
      .from("oauth_tokens")
      .update({
        ...(sync.credentialId ? { n8n_credential_id: sync.credentialId } : {}),
        service_credentials: serviceCreds,
      })
      .eq("user_id", user.id)
      .eq("provider", "google");
  }

  const failed = serviceResults.filter((r) => !r.ok);

  if (!sync.ok || failed.length) {
    // بعض الاعتمادات لم تُنشأ — نسمّيها بدل ادّعاء نجاح كامل
    const parts = [
      ...(sync.ok ? [] : [`Gmail: ${sync.error ?? "فشل"}`]),
      ...failed.map((f) => `${f.service}: ${f.error ?? "فشل"}`),
    ];
    return back(origin, {
      gmail_connected: "true",
      gmail_error: `حُفظ الربط لكن تعذّر إنشاء بعض الاعتمادات — ${parts.join(" · ")}`,
    });
  }

  return back(origin, { gmail_connected: "true" });
}
