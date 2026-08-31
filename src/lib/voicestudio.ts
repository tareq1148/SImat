// تكامل VoiceStudio — منصة الصوت المحلية مفتوحة المصدر (OpenAI-compatible API)
// https://github.com/debpalash/VoiceStudio — تعمل على localhost:3900 وتدعم العربية

// مفتاح التفعيل: 0 = صوت المتصفح (سريع، الافتراضي الحالي)؛ 1 = VoiceStudio المحلي
const ENABLED = process.env.VOICESTUDIO_ENABLED === "1";
const BASE = process.env.VOICESTUDIO_BASE_URL ?? "http://localhost:3900/v1";
const TTS_MODEL = process.env.VOICESTUDIO_TTS_MODEL ?? "tts-1";
const ASR_MODEL = process.env.VOICESTUDIO_ASR_MODEL ?? "whisper-1";
const VOICE = process.env.VOICESTUDIO_VOICE ?? "";

export async function voiceStudioStatus(): Promise<{
  available: boolean;
  voices: { id: string; name: string }[];
}> {
  if (!ENABLED) return { available: false, voices: [] };
  try {
    const res = await fetch(`${BASE}/audio/voices`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { available: false, voices: [] };
    const data = (await res.json()) as {
      voices?: { id?: string; voice_id?: string; name?: string }[];
      data?: { id?: string; voice_id?: string; name?: string }[];
    };
    const list = data.voices ?? data.data ?? [];
    return {
      available: true,
      voices: list.map((v) => ({
        id: v.id ?? v.voice_id ?? "",
        name: v.name ?? v.id ?? v.voice_id ?? "صوت",
      })),
    };
  } catch {
    return { available: false, voices: [] };
  }
}

export async function transcribeAudio(
  file: Blob,
  filename: string
): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", ASR_MODEL);
  form.append("language", "ar");
  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    throw new Error(`VoiceStudio ASR ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const body: Record<string, string> = {
    model: TTS_MODEL,
    input: text,
    response_format: "mp3",
  };
  if (VOICE) body.voice = VOICE;
  const res = await fetch(`${BASE}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    throw new Error(`VoiceStudio TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.arrayBuffer();
}
