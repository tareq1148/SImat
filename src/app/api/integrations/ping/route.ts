import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { pingService } from "@/lib/n8n/client";

const SERVICES = ["drive", "sheets", "slides", "calendar", "docs"] as const;

// نبضة فحص لخدمة واحدة أو للخمس معًا — تغذّي صفحة اختبار التكاملات
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { service?: string };
  const one = body.service;

  if (one) {
    if (!SERVICES.includes(one as (typeof SERVICES)[number]))
      return Response.json({ error: `خدمة غير معروفة: ${one}` }, { status: 400 });
    const r = await pingService(one, user.id);
    return Response.json({ results: [r] });
  }

  // الخمس بالتوازي — الفحص قراءةٌ خفيفة فلا داعي للتسلسل
  const results = await Promise.all(SERVICES.map((s) => pingService(s, user.id)));
  return Response.json({ results });
}
