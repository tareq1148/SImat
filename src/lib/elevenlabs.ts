// تكامل ElevenLabs — نطق وتفريغ بجودة عربية عالية
// STT: POST /v1/speech-to-text (متعدد الأجزاء) | TTS: POST /v1/text-to-speech/{voice_id}
// الأصوات: GET /v2/voices — نكتشف صوتًا من مكتبة المستخدم إن لم يُحدَّد في البيئة،
// فلا نضع معرّف صوت مكتوبًا في الكود قد لا يملكه حسابه.

const KEY = process.env.ELEVENLABS_API_KEY ?? "";
const BASE = "https://api.elevenlabs.io";
// flash_v2_5 هو ما دُرِّب عليه صوت Saad السعودي فعلًا (تحقّقنا من high_quality_base_model_ids)
// وهو نصف تكلفة multilingual_v2. الافتراض هنا يهم: بيئة بلا متغيرات كانت تقع على الأغلى.
const TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL ?? "eleven_flash_v2_5";
const STT_MODEL = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2";
const CONFIGURED_VOICE = process.env.ELEVENLABS_VOICE_ID ?? "";
// لغة التفريغ: تركها فارغة يجعل النموذج يكتشفها — أدق حين يخلط المستخدم عربي/إنجليزي
const STT_LANG = process.env.ELEVENLABS_STT_LANG ?? "";
// النطق منفصل عن التفريغ عمدًا: الباقة المجانية تمنع أصوات المكتبة العربية،
// وأصوات الحساب الإنجليزية تنطق العربية مشوّهة. أطفئه ودع المتصفح ينطق
// حتى تُضاف أصوات عربية، والتفريغ يبقى على ElevenLabs لأنه يعمل ويحسّن كثيرًا.
const TTS_ON = process.env.ELEVENLABS_TTS !== "0";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// قابلة للضبط من البيئة دون لمس الكود
const VOICE_SETTINGS = {
  stability: num(process.env.ELEVENLABS_STABILITY, 0.35),
  similarity_boost: num(process.env.ELEVENLABS_SIMILARITY, 0.8),
  style: num(process.env.ELEVENLABS_STYLE, 0.35),
  speed: num(process.env.ELEVENLABS_SPEED, 1.12),
  use_speaker_boost: true,
};

// مفردات نجدية وأسماء منصات معرَّبة — تحفظ لهجة المتكلم كما نطقها
const STT_KEYTERMS = [
  "وش", "تبي", "أبي", "الحين", "إيه", "زين", "اللي", "أبشر", "كذا", "خلاص",
  "إيميل", "الإيميل", "إيميلات", "الإيميلات",
  "قوقل شيتس", "قوقل درايف", "قوقل كاليندر", "تلقرام", "جيميل", "سلاك",
  "إنستقرام", "تيك توك", "وَتيرة",
];

export function hasElevenLabs(): boolean {
  return KEY.trim().length > 0;
}

/** هل ننطق عبر ElevenLabs؟ التفريغ يعمل دائمًا متى وُجد المفتاح */
export function elevenTtsEnabled(): boolean {
  return hasElevenLabs() && TTS_ON;
}

function headers(): Record<string, string> {
  return { "xi-api-key": KEY };
}

interface VoiceRef {
  id: string;
  name: string;
  /** لهجة الصوت كما يصنّفها المزوّد — نستعملها لتفضيل صوت عربي */
  accent?: string;
}

// نتيجة اكتشاف الصوت تُحفظ في ذاكرة العملية — نداء واحد لا نداء مع كل نطق
let voiceCache: VoiceRef | null = null;
let voicesCache: VoiceRef[] | null = null;

async function listVoices(): Promise<VoiceRef[]> {
  if (voicesCache) return voicesCache;
  const res = await fetch(`${BASE}/v2/voices?page_size=30`, {
    headers: headers(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`voices ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    voices?: { voice_id?: string; name?: string; labels?: Record<string, string> }[];
  };
  voicesCache = (data.voices ?? [])
    .filter((v) => v.voice_id)
    .map((v) => ({
      id: v.voice_id as string,
      name: v.name ?? "صوت",
      accent: v.labels?.accent ?? v.labels?.language,
    }));
  return voicesCache;
}

async function resolveVoice(): Promise<VoiceRef> {
  if (CONFIGURED_VOICE) return { id: CONFIGURED_VOICE, name: "المُعرَّف في البيئة" };
  if (voiceCache) return voiceCache;
  const list = await listVoices();
  if (list.length === 0) throw new Error("لا توجد أصوات في حساب ElevenLabs");
  // «أول صوت» كان يقع على صوت إنجليزي فيُنطق العربي بلكنة أجنبية.
  // نفضّل السعودي، ثم أي عربي، ثم الأول كملاذ أخير.
  voiceCache =
    list.find((v) => /saudi/i.test(v.accent ?? "")) ??
    list.find((v) => /^ar|arab/i.test(v.accent ?? "")) ??
    list[0];
  return voiceCache;
}

export async function elevenLabsStatus(): Promise<{
  available: boolean;
  voices: VoiceRef[];
  voice?: VoiceRef;
  error?: string;
}> {
  if (!hasElevenLabs()) return { available: false, voices: [] };
  try {
    const voices = await listVoices();
    const voice = await resolveVoice();
    return { available: true, voices, voice };
  } catch (err) {
    return {
      available: false,
      voices: [],
      error: err instanceof Error ? err.message : "تعذر الوصول إلى ElevenLabs",
    };
  }
}

// حزام أمان ثانٍ: ينزع أي وسم بين قوسين مربّعين، ويرجع فراغًا إن لم يبقَ كلام.
// الفراغ يعني «لم يتكلم» فيعاود الاستماع، بدل أن يرد على ضجيج.
export function cleanTranscript(raw: string): string {
  const stripped = raw.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  return /[\p{L}\p{N}]/u.test(stripped) ? stripped : "";
}

/** تفريغ تسجيل إلى نص */
export async function elevenTranscribe(file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("model_id", STT_MODEL);
  form.append("file", file, filename);
  if (STT_LANG) form.append("language_code", STT_LANG);
  // بدونها يُرجع النموذج وسومًا مثل [background noise] و[outro jingle]
  // فتُرسَل كأنها إجابة المستخدم — وهذا يقطع المقابلة
  form.append("tag_audio_events", "false");
  // كلمات اللهجة وأسماء المنصات معرَّبة: بدونها يترجم النموذج «قوقل شيتس» إلى
  // Google Sheets و«رايك» إلى «رأيك» — أي يعيد كتابة كلامك فصحى.
  // تُرسَل حقولًا مكرّرة لا مصفوفة JSON.
  for (const k of STT_KEYTERMS) form.append("keyterms", k);

  const res = await fetch(`${BASE}/v1/speech-to-text`, {
    method: "POST",
    headers: headers(),
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { text?: string };
  return cleanTranscript(data.text ?? "");
}

/** نطق نص — يرجع صوت mp3 */
export async function elevenSpeak(
  text: string,
  previousText?: string
): Promise<ArrayBuffer> {
  const voice = await resolveVoice();
  const res = await fetch(
    // نبقى على 44.1kHz/128: الصيغة الأخف توفّر 0.16s فقط وتُرقّ الصوت،
    // والمستخدم حكم بأذنه على هذه الصيغة تحديدًا.
    `${BASE}/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        // إعدادات «العفوي» — اختارها المستخدم بأذنه من أربع عيّنات:
        // ثبات منخفض = تنويع نبرة كإنسان، وأسلوب 0.35 = تعبير بلا تشويه،
        // وسرعة 1.12 لأن السعودي يتكلم أسرع من الإلقاء الرسمي.
        voice_settings: VOICE_SETTINGS,
      }),
      signal: AbortSignal.timeout(120000),
    }
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.arrayBuffer();
}
