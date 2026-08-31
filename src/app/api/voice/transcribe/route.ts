import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/voicestudio";

export const maxDuration = 180;

// تحويل تسجيل الموظف الصوتي إلى نص عبر VoiceStudio المحلي (خصوصية كاملة)
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "لا يوجد تسجيل صوتي" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return Response.json({ error: "التسجيل أكبر من 25MB" }, { status: 400 });
  }

  try {
    const name = file instanceof File && file.name ? file.name : "recording.webm";
    const text = await transcribeAudio(file, name);
    return Response.json({ text });
  } catch (err) {
    return Response.json(
      {
        error:
          "تعذر التفريغ عبر VoiceStudio — تأكد أنه يعمل على جهازك. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 }
    );
  }
}
