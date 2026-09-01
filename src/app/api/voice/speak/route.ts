import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { elevenSpeak, hasElevenLabs } from "@/lib/elevenlabs";
import { synthesizeSpeech } from "@/lib/voicestudio";

export const maxDuration = 180;

// نطق ردود «وَتيرة» — ElevenLabs أولًا ثم VoiceStudio المحلي
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { text } = (await req.json()) as { text: string };
  const clean = (text ?? "").trim().slice(0, 2500);
  if (!clean) return Response.json({ error: "لا يوجد نص" }, { status: 400 });

  const audioResponse = (audio: ArrayBuffer, provider: string) =>
    new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Voice-Provider": provider,
      },
    });

  if (hasElevenLabs()) {
    try {
      return audioResponse(await elevenSpeak(clean), "elevenlabs");
    } catch (err) {
      return Response.json(
        {
          error:
            "تعذر النطق عبر ElevenLabs — " +
            (err instanceof Error ? err.message : "خطأ غير معروف"),
        },
        { status: 502 }
      );
    }
  }

  try {
    const audio = await synthesizeSpeech(clean);
    return audioResponse(audio as ArrayBuffer, "voicestudio");
  } catch (err) {
    return Response.json(
      {
        error:
          "تعذر النطق عبر VoiceStudio — تأكد أنه يعمل. " +
          (err instanceof Error ? err.message : ""),
      },
      { status: 502 }
    );
  }
}
