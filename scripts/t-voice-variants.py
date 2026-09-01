# -*- coding: utf-8 -*-
"""يولّد عيّنات صوتية بإعدادات مختلفة ليختار المستخدم بأذنه.
يُشغَّل يدويًا: python scripts/t-voice-variants.py
يكتب الملفات في voice-samples/ ثم تُرسَل للمستخدم."""
import io, json, os, urllib.request

KEY = None
VOICE = None
for line in io.open(".env.local", encoding="utf-8"):
    if line.startswith("ELEVENLABS_API_KEY="):
        KEY = line.split("=", 1)[1].strip()
    if line.startswith("ELEVENLABS_VOICE_ID="):
        VOICE = line.split("=", 1)[1].strip()

# نصّ من الوضع المنطوق الحقيقي — لا جملة مصطنعة
TXT = u"طيب تمام، فهمت عليك. الملخص هذا تبي يوصلك على تلقرام ولا على الإيميل نفسه؟"

VARIANTS = [
    ("1-current",    "eleven_flash_v2_5",      {"stability": 0.45, "similarity_boost": 0.75, "speed": 1.0}),
    ("2-expressive", "eleven_flash_v2_5",      {"stability": 0.30, "similarity_boost": 0.75, "style": 0.45, "speed": 1.05}),
    ("3-warm",       "eleven_multilingual_v2", {"stability": 0.40, "similarity_boost": 0.85, "style": 0.30, "speed": 1.0}),
    ("4-casual",     "eleven_flash_v2_5",      {"stability": 0.35, "similarity_boost": 0.80, "style": 0.35, "speed": 1.12}),
]

os.makedirs("voice-samples", exist_ok=True)
report = []
for name, model, settings in VARIANTS:
    body = json.dumps({"text": TXT, "model_id": model, "voice_settings": settings},
                      ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_128" % VOICE,
        data=body, headers={"xi-api-key": KEY, "Content-Type": "application/json; charset=utf-8"})
    try:
        audio = urllib.request.urlopen(req, timeout=90).read()
        path = os.path.join("voice-samples", "%s.mp3" % name)
        open(path, "wb").write(audio)
        report.append(u"%s  %s  %s  (%d bytes)" % (name, model, json.dumps(settings), len(audio)))
    except Exception as e:
        report.append(u"%s فشل: %s" % (name, e))

io.open("voice-samples/README.txt", "w", encoding="utf-8").write(
    u"النص: %s\n\n%s\n" % (TXT, u"\n".join(report)))
