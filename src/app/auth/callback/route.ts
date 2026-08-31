import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// عودة OAuth (دخول Google): تبديل الرمز بجلسة ثم التوجيه للوحة
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorDesc = url.searchParams.get("error_description");

  if (errorDesc) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDesc)}`, url.origin)
    );
  }

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
      );
    }
  }

  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
