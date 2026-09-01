"use client";

// طبقة الصوت الموحدة — الترتيب: ElevenLabs ← VoiceStudio المحلي ← صوت المتصفح
// ASR: مايك → نص | TTS: نطق ردود «وَتيرة»

import { useCallback, useEffect, useRef, useState } from "react";

type VoiceMode = "server" | "browser" | "none";

interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getBrowserRecognition(): BrowserRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function useVoice(onTranscript: (text: string) => void) {
  const [mode, setMode] = useState<VoiceMode>("none");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recogRef = useRef<BrowserRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  // كشف الصمت: يوقف التسجيل وحده فتصير المحادثة متصلة بلا ضغط زر
  const vadRef = useRef<{ ctx: AudioContext; raf: number; stream: MediaStream } | null>(null);

  useEffect(() => {
    fetch("/api/voice/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.available) {
          setMode("server");
          setProvider(d.provider ?? null);
        } else if (getBrowserRecognition() || "speechSynthesis" in window) {
          setMode("browser");
          setProvider("browser");
        } else setMode("none");
      })
      .catch(() => {
        setMode(getBrowserRecognition() ? "browser" : "none");
      });
    try {
      setSpeakEnabled(localStorage.getItem("mv_speak") === "1");
    } catch {}
  }, []);

  const toggleSpeak = useCallback(() => {
    setSpeakEnabled((v) => {
      try {
        localStorage.setItem("mv_speak", v ? "0" : "1");
      } catch {}
      if (v) {
        audioRef.current?.pause();
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        setSpeaking(false);
      }
      return !v;
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const teardownVad = useCallback(() => {
    const v = vadRef.current;
    if (!v) return;
    cancelAnimationFrame(v.raf);
    void v.ctx.close().catch(() => {});
    vadRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (mode === "browser") {
      const recog = getBrowserRecognition();
      if (!recog) {
        setError("متصفحك لا يدعم التعرف على الصوت");
        return;
      }
      recogRef.current = recog;
      recog.lang = "ar-SA";
      recog.continuous = false;
      recog.interimResults = false;
      recog.onresult = (e) => {
        const text = Array.from({ length: e.results.length })
          .map((_, i) => e.results[i][0]?.transcript ?? "")
          .join(" ")
          .trim();
        if (text) onTranscript(text);
      };
      recog.onerror = (e) => {
        setError(e.error === "not-allowed" ? "اسمح للمايك من المتصفح" : "تعذر الالتقاط — حاول ثانية");
        setRecording(false);
      };
      recog.onend = () => setRecording(false);
      recog.start();
      setRecording(true);
      return;
    }

    // خادم (ElevenLabs أو VoiceStudio): نسجّل ثم نرفع.
    // MediaRecorder لا يتوقف وحده كما يفعل تعرّف المتصفح، فنقيس مستوى الصوت
    // ونوقف التسجيل بعد صمت قصير — بهذا تصير المحادثة متصلة بلا ضغط زر.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        teardownVad();
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        // أقل من نصف ثانية = نقرة أو ضجيج، لا كلام
        if (blob.size < 4000) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "تعذر التفريغ");
          if (data.text?.trim()) onTranscript(data.text.trim());
        } catch (err) {
          setError(err instanceof Error ? err.message : "تعذر التفريغ");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      setRecording(true);

      // ===== كشف نشاط الصوت =====
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);

      const SPEECH_RMS = 0.022; // عتبة اعتبار الإشارة كلامًا
      const SILENCE_MS = 1300; // صمت بعد الكلام ← أنهِ الدور
      const LEAD_IN_MS = 6000; // مهلة البدء قبل أن نيأس من كلام أصلًا
      const MAX_MS = 30000; // سقف أمان للدور الواحد

      const startedAt = performance.now();
      let spokeAt = 0;
      let quietSince = 0;

      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const t = performance.now();

        if (rms > SPEECH_RMS) {
          if (!spokeAt) spokeAt = t;
          quietSince = 0;
        } else if (spokeAt) {
          if (!quietSince) quietSince = t;
          else if (t - quietSince > SILENCE_MS) {
            mediaRef.current?.stop();
            return;
          }
        }

        // لم ينطق شيئًا خلال مهلة البدء، أو تجاوز سقف الدور
        if ((!spokeAt && t - startedAt > LEAD_IN_MS) || t - startedAt > MAX_MS) {
          mediaRef.current?.stop();
          return;
        }
        if (vadRef.current) vadRef.current.raf = requestAnimationFrame(tick);
      };

      vadRef.current = { ctx, raf: requestAnimationFrame(tick), stream };
    } catch {
      setError("اسمح للمايك من المتصفح");
      setRecording(false);
    }
  }, [mode, onTranscript, teardownVad]);

  const stopRecording = useCallback(() => {
    if (mode === "browser") {
      setRecording(false);
      recogRef.current?.stop();
      return;
    }
    // في فرع الخادم يتكفّل onstop بإطفاء الحالة بعد جمع التسجيل
    mediaRef.current?.stop();
  }, [mode]);

  // تنظيف عند مغادرة الصفحة أثناء التسجيل
  useEffect(() => () => teardownVad(), [teardownVad]);

  // force: وضع المحادثة الصوتية ينطق دائمًا، بغض النظر عن مفتاح «اسمع الردود»
  const speak = useCallback(
    async (text: string, force = false) => {
      if ((!speakEnabled && !force) || !text.trim()) return;
      if (mode === "server") {
        try {
          const res = await fetch("/api/voice/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) throw new Error();
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          audioRef.current?.pause();
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onplay = () => setSpeaking(true);
          audio.onpause = () => setSpeaking(false);
          audio.onended = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
          };
          await audio.play();
          return;
        } catch {
          // نسقط لصوت المتصفح
        }
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ar-SA";
        u.rate = 1.05;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      }
    },
    [mode, speakEnabled]
  );

  return {
    mode,
    provider,
    recording,
    transcribing,
    speakEnabled,
    speaking,
    error,
    startRecording,
    stopRecording,
    toggleSpeak,
    stopSpeaking,
    speak,
    clearError: () => setError(null),
  };
}
