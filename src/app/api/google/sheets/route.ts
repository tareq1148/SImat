import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getValidGoogleAccessToken } from "@/lib/google-tokens";
import { listSpreadsheets } from "@/lib/google-lookup";

// جداول المستخدم: يُختار منها بالاسم، ويُنشأ جديدٌ عند الطلب.
// الربط أعطانا حسابه، فلا معنى لأن يكتب اسمًا نبحث عنه ثم نخيب — نُريه ما
// عنده فعلًا، ونصنع له ما ليس عنده.

/** قائمة جداوله الأحدث */
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const sheets = await listSpreadsheets(user.id, 25);
  return Response.json({ sheets });
}

/** ينشئ جدولًا باسمٍ يختاره — ويردّ معرّفه ليُثبَّت في الخطوة فورًا */
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const title = String(name ?? "").trim();
  if (!title) return Response.json({ error: "اكتب اسمًا للجدول" }, { status: 400 });

  const token = await getValidGoogleAccessToken(user.id);
  if (!token.ok)
    return Response.json(
      { error: "اربط حساب Google Sheets أولًا" },
      { status: 400 }
    );

  try {
    const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { title } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return Response.json(
        { error: `تعذّر إنشاء الجدول (${res.status}): ${detail}` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as {
      spreadsheetId?: string;
      properties?: { title?: string };
    };
    if (!data.spreadsheetId)
      return Response.json({ error: "أُنشئ الجدول بلا معرّف" }, { status: 502 });

    return Response.json({
      id: data.spreadsheetId,
      name: data.properties?.title ?? title,
    });
  } catch {
    return Response.json({ error: "تعذّر الوصول إلى Google" }, { status: 502 });
  }
}
