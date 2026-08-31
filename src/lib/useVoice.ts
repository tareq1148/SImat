"use client";

// طبقة الصوت الموحدة: VoiceStudio المحلي أولًا، وصوت المتصفح كبديل فوري
// ASR: مايك → نص | TTS: نطق ردود «سِمَاط»

import { useCallback, useEffect, useRef, useState } from "react";

type VoiceMode = "voicestudio" | "browser" | "none";

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
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recogRef = useRef<BrowserRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/voice/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.available) setMode("voicestudio");
        else if (getBrowserRecognition() || "speechSynthesis" in window)
          setMode("browser");
        else setMode("none");
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
      }
      return !v;
    });
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

    // VoiceStudio: تسجيل ثم تفريغ محلي
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
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
    } catch {
      setError("اسمح للمايك من المتصفح");
    }
  }, [mode, onTranscript]);

  const stopRecording = useCallback(() => {
    setRecording(false);
    if (mode === "browser") {
      recogRef.current?.stop();
      return;
    }
    mediaRef.current?.stop();
  }, [mode]);

  const speak = useCallback(
    async (text: string) => {
      if (!speakEnabled || !text.trim()) return;
      if (mode === "voicestudio") {
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
          audio.onended = () => URL.revokeObjectURL(url);
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
        window.speechSynthesis.speak(u);
      }
    },
    [mode, speakEnabled]
  );

  return {
    mode,
    recording,
    transcribing,
    speakEnabled,
    error,
    startRecording,
    stopRecording,
    toggleSpeak,
    speak,
    clearError: () => setError(null),
  };
}
