# -*- coding: utf-8 -*-
"""قياس زمن نماذج النطق وجودة نطقها للعربية — يُشغَّل يدويًا عند ضبط الصوت."""
import io, json, time, urllib.request

KEY = None
for line in io.open(".env.local", encoding="utf-8"):
    if line.startswith("ELEVENLABS_API_KEY="):
        KEY = line.split("=", 1)[1].strip()

VOICE = "3vR1KVyyNDhdkucpugQI"  # Saad
TXT = u"تمام، وضح لي بس شي واحد عشان أظبط لك المسار صح: وين تبي يوصلك الملخص اليومي؟"


def tts(model):
    body = json.dumps({"text": TXT, "model_id": model}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_128" % VOICE,
        data=body,
        headers={"xi-api-key": KEY, "Content-Type": "application/json; charset=utf-8"},
    )
    t0 = time.time()
    audio = urllib.request.urlopen(req, timeout=120).read()
    return time.time() - t0, audio


def stt(audio, tag_events=True):
    b = "----wt"
    parts = []
    fields = [("model_id", "scribe_v1"), ("language_code", "ar")]
    if not tag_events:
        fields.append(("tag_audio_events", "false"))
    for k, v in fields:
        parts.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (b, k, v)).encode())
    parts.append(("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n" % b).encode())
    parts.append(audio)
    parts.append(("\r\n--%s--\r\n" % b).encode())
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/speech-to-text",
        data=b"".join(parts),
        headers={"xi-api-key": KEY, "Content-Type": "multipart/form-data; boundary=%s" % b},
    )
    t0 = time.time()
    out = json.loads(urllib.request.urlopen(req, timeout=120).read().decode("utf-8"))
    return time.time() - t0, out


lines = []
for model in ("eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_multilingual_v2"):
    try:
        dt, audio = tts(model)
        st, out = stt(audio)
        lines.append(u"%-24s TTS %.2fs | %5d bytes | STT %.2fs | %s"
                     % (model, dt, len(audio), st, out.get("text", "")[:58]))
    except Exception as e:
        lines.append(u"%-24s فشل: %s" % (model, e))

io.open("voice-latency.txt", "w", encoding="utf-8").write(u"\n".join(lines))
