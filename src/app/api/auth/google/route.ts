import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  OAUTH_STATE_COOKIE,
  buildConsentUrl,
  googleConfig,
  scopesFor,
} from "@/lib/google-oauth";

// بدء ربط Gmail — يحوّل المستخدم إلى شاشة موافقة جوجل
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // الربط يخصّ حسابًا بعينه — بلا جلسة لا نعرف لمن نحفظ التوكن
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  const cfg = googleConfig();
  if ("error" in cfg) {
    return NextResponse.redirect(
      new URL(`/chat?gmail_error=${encodeURIComponent(cfg.error)}`, req.nextUrl.origin)
    );
  }

  // خدمة بعينها → نطاقاتها وحدها. جوجل يراكم ما سبق منحه عبر
  // include_granted_scopes، فلا يفقد المستخدم أذوناته السابقة.
  const service = req.nextUrl.searchParams.get("service") ?? undefined;

  // حالة CSRF: قيمة عشوائية تُحفظ في كوكي وتُقارَن عند العودة
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(
    buildConsentUrl(cfg.config, state, scopesFor(service))
  );
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // عشر دقائق تكفي لإتمام الموافقة
  });
  return res;
}
