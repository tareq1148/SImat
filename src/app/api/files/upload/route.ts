import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// رفع مرفقات المحادثة إلى تخزين خاص بالمستخدم
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const specId = (form.get("specId") as string) || null;
  if (!(file instanceof File) || file.size === 0)
    return Response.json({ error: "لا يوجد ملف" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return Response.json({ error: "الحد الأقصى 10MB للملف" }, { status: 400 });
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime))
    return Response.json(
      { error: `نوع الملف غير مدعوم (${mime}) — المدعوم: صور، PDF، نصوص، CSV، Excel، Word` },
      { status: 400 }
    );

  const safeName = file.name.replace(/[^\w.\-؀-ۿ ]+/g, "_").slice(0, 100);
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("task-files")
    .upload(path, file, { contentType: mime });
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  const { data: row, error: dbErr } = await supabase
    .from("spec_files")
    .insert({
      user_id: user.id,
      task_spec_id: specId,
      name: file.name,
      path,
      mime,
      size: file.size,
    })
    .select("id, name, mime, size")
    .single();
  if (dbErr || !row)
    return Response.json({ error: "تعذر حفظ بيانات الملف" }, { status: 500 });

  return Response.json({ file: row });
}
