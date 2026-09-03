import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// جلسة ضيف: من دخل ولم يسجّل يُفتح له حسابٌ مجهول فيبني مساره فورًا.
//
// كل شيء في القاعدة مقيّد بمعرّف المستخدم (RLS)، فلا سبيل لعملٍ بلا هويّة.
// وحساب Supabase المجهول هويّةٌ حقيقية بلا بريد: تعمل معه السياسات كما هي،
// ويُرقّى لاحقًا إلى حسابٍ دائم بربط جوجل به فيحتفظ بما بناه.
//
// والإنشاء هنا لا في تصيير الصفحة: الصفحات لا تكتب كوكيز في Next، ومعالج
// الطريق يكتبها. فمن لا جلسة له يُحوّل إلى هنا ثم يعود من حيث أتى.
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") || "/chat";
  // مقصورٌ على مسارات داخل الموقع — لئلّا يصير تحويلًا مفتوحًا لأي عنوان
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/chat";

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(new URL(dest, req.nextUrl.origin));

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    // الميزة تُفعَّل من لوحة Supabase لا من الكود؛ فإن كانت مطفأة عاد
    // المستخدم إلى الدخول المعتاد برسالةٍ تقول السبب لا تصمت عنه
    const msg = /anonymous/i.test(error.message)
      ? "الدخول كضيف غير مفعّل — سجّل دخولك."
      : error.message;
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, req.nextUrl.origin)
    );
  }

  return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
}
