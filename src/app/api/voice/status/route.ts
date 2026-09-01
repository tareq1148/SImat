import { elevenLabsStatus, elevenTtsEnabled, hasElevenLabs } from "@/lib/elevenlabs";
import { voiceStudioStatus } from "@/lib/voicestudio";

// ترتيب التفضيل: ElevenLabs (جودة عربية عالية) ← VoiceStudio المحلي ← صوت المتصفح
export async function GET() {
  if (hasElevenLabs()) {
    const el = await elevenLabsStatus();
    if (el.available) {
      return Response.json({
        available: true,
        provider: "elevenlabs",
        stt: true,
        tts: elevenTtsEnabled(),
        voice: elevenTtsEnabled() ? (el.voice ?? null) : null,
        voices: el.voices,
      });
    }
    // المفتاح موجود لكن النداء فشل — نمرّر السبب بدل الصمت
    const vs = await voiceStudioStatus();
    return Response.json({
      ...vs,
      provider: vs.available ? "voicestudio" : null,
      stt: vs.available,
      tts: vs.available,
      error: el.error,
    });
  }

  const status = await voiceStudioStatus();
  return Response.json({
    ...status,
    provider: status.available ? "voicestudio" : null,
    stt: status.available,
    tts: status.available,
  });
}
