# -*- coding: utf-8 -*-
"""يتحقق من: هل scribe_v2 متاح؟ وهل keyterms تحفظ اللهجة السعودية؟
يولّد جملة عامية بالصوت السعودي ثم يفرّغها بثلاث طرق ويقارن."""
import io, json, urllib.request

KEY = VOICE = None
for line in io.open(".env.local", encoding="utf-8"):
    if line.startswith("ELEVENLABS_API_KEY="):
        KEY = line.split("=", 1)[1].strip()
    if line.startswith("ELEVENLABS_VOICE_ID="):
        VOICE = line.split("=", 1)[1].strip()

TXT = u"إيه، أبي الإيميلات اللي تجيني من العملاء تنحط في قوقل شيتس على طول، وش رايك؟"


def tts(text):
    body = json.dumps({"text": text, "model_id": "eleven_flash_v2_5"}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_128" % VOICE,
        data=body, headers={"xi-api-key": KEY, "Content-Type": "application/json; charset=utf-8"})
    return urllib.request.urlopen(req, timeout=90).read()


def stt(audio, fields):
    b = "----wt"
    parts = []
    for k, v in fields:
        parts.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n" % (b, k)).encode()
                     + v.encode("utf-8") + b"\r\n")
    parts.append(("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\n"
                  "Content-Type: audio/mpeg\r\n\r\n" % b).encode())
    parts.append(audio)
    parts.append(("\r\n--%s--\r\n" % b).encode())
    req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text",
                                 data=b"".join(parts),
                                 headers={"xi-api-key": KEY,
                                          "Content-Type": "multipart/form-data; boundary=%s" % b})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=120).read().decode("utf-8")).get("text", "")
    except urllib.error.HTTPError as e:
        return u"HTTP %s: %s" % (e.code, e.read().decode("utf-8", "replace")[:150])
    except Exception as e:
        return u"خطأ: %s" % e


KEYTERMS = [u"وش", u"تبي", u"أبي", u"الحين", u"إيه", u"زين", u"اللي", u"أبشر",
            u"إيميل", u"الإيميل", u"إيميلات", u"الإيميلات",
            u"قوقل شيتس", u"قوقل درايف", u"تلقرام", u"جيميل", u"سلاك"]

audio = tts(TXT)
out = []
out.append(u"الأصل            : " + TXT)
out.append(u"scribe_v1        : " + stt(audio, [("model_id", "scribe_v1")]))
out.append(u"scribe_v2        : " + stt(audio, [("model_id", "scribe_v2")]))
kt = [("model_id", "scribe_v2")] + [("keyterms", k) for k in KEYTERMS]
out.append(u"v2 + keyterms    : " + stt(audio, kt))
kt1 = [("model_id", "scribe_v1")] + [("keyterms", k) for k in KEYTERMS]
out.append(u"v1 + keyterms    : " + stt(audio, kt1))

io.open("stt-dialect.txt", "w", encoding="utf-8").write(u"\n".join(out))
