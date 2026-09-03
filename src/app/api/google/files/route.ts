import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getValidGoogleAccessToken } from "@/lib/google-tokens";
import {
  FOLDER_MIME,
  SPREADSHEET_MIME,
  listDriveFilesByType,
} from "@/lib/google-lookup";

// موارد المستخدم في جوجل: يُختار منها بالاسم، ويُنشأ جديدٌ عند الطلب.
// الربط أعطانا حسابه، فلا معنى لأن يكتب اسمًا نبحث عنه ثم نخيب — نُريه ما
// عنده فعلًا، ونصنع له ما ليس عنده.

const KINDS = {
  sheet: {
    mime: SPREADSHEET_MIME,
    // لكل نوعٍ واجهةُ إنشائه: واجهة Drive تصنع مجلّدًا، وواجهات المستندات
    // تصنع ملفًّا مهيّأً بمحتواه الافتراضي
    create: {
      url: "https://sheets.googleapis.com/v4/spreadsheets",
      body: (t: string) => ({ properties: { title: t } }),
      idOf: (d: Record<string, unknown>) => d.spreadsheetId as string | undefined,
    },
  },
  folder: {
    mime: FOLDER_MIME,
    create: {
      url: "https://www.googleapis.com/drive/v3/files",
      body: (t: string) => ({ name: t, mimeType: FOLDER_MIME }),
      idOf: (d: Record<string, unknown>) => d.id as string | undefined,
    },
  },
} as const;

type Kind = keyof typeof KINDS;

function kindOf(req: NextRequest, fallback?: string): Kind | null {
  const k = req.nextUrl.searchParams.get("kind") ?? fallback ?? "";
  return k in KINDS ? (k as Kind) : null;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const kind = kindOf(req);
  if (!kind) return Response.json({ error: "نوع غير معروف" }, { status: 400 });

  const files = await listDriveFilesByType(user.id, KINDS[kind].mime, 25);
  return Response.json({ files });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    kind?: string;
  };
  const kind = kindOf(req, body.kind);
  if (!kind) return Response.json({ error: "نوع غير معروف" }, { status: 400 });

  const title = String(body.name ?? "").trim();
  if (!title) return Response.json({ error: "اكتب اسمًا" }, { status: 400 });

  const token = await getValidGoogleAccessToken(user.id);
  if (!token.ok)
    return Response.json({ error: "اربط حساب Google أولًا" }, { status: 400 });

  const spec = KINDS[kind].create;
  try {
    const res = await fetch(spec.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(spec.body(title)),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return Response.json(
        { error: `تعذّر الإنشاء (${res.status}): ${detail}` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as Record<string, unknown>;
    const id = spec.idOf(data);
    if (!id) return Response.json({ error: "أُنشئ بلا معرّف" }, { status: 502 });

    return Response.json({ id, name: title });
  } catch {
    return Response.json({ error: "تعذّر الوصول إلى Google" }, { status: 502 });
  }
}
