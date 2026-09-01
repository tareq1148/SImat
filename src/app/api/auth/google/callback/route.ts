import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import {
  OAUTH_STATE_COOKIE,
  exchangeCodeForTokens,
  googleConfig,
} from "@/lib/google-oauth";

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

  return back(origin, { gmail_connected: "true" });
}
