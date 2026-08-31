"use client";

// موجة صوت حية — mic: تتحرك مع صوتك فعليًا عبر Web Audio؛ ambient: نبض ناعم أثناء نطق سِمَاط
// عند تعذر الوصول للمايك تسقط تلقائيًا للنبض حتى لا تظهر مساحة ميتة

import { useEffect, useRef, useState } from "react";

const BARS = 36;

function AmbientBars({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center gap-[3px] w-full" style={{ height }}>
      {Array.from({ length: BARS }).map((_, i) => {
        const mid = Math.abs(i - BARS / 2) / (BARS / 2);
        return (
          <span
            key={i}
            className="wave-bar rounded-full"
            style={{
              width: 3,
              height: Math.max(6, height * (0.85 - mid * 0.55)),
              background: "var(--accent-bg)",
              animationDelay: `${(i % 6) * 0.12}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceWave({
  mode,
  height = 40,
}: {
  mode: "mic" | "ambient";
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [micFailed, setMicFailed] = useState(false);

  useEffect(() => {
    if (mode !== "mic") return;
    let raf = 0;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        canvas.width = w * dpr;
        canvas.height = height * dpr;
        const g = canvas.getContext("2d")!;
        g.scale(dpr, dpr);
        const accent =
          getComputedStyle(document.documentElement).getPropertyValue("--accent-bg").trim() ||
          "#0891b2";

        const draw = () => {
          analyser.getByteFrequencyData(data);
          g.clearRect(0, 0, w, height);
          const step = w / BARS;
          for (let i = 0; i < BARS; i++) {
            // مرآة حول المنتصف مثل موجات الكلام الطبيعية
            const idx = Math.floor(Math.abs(i - BARS / 2) * (data.length / BARS) * 0.9);
            const v = data[idx] / 255;
            const h = Math.max(4, v * height * 0.95);
            g.fillStyle = accent;
            g.globalAlpha = 0.45 + v * 0.55;
            const x = i * step + step / 2 - 1.5;
            const r = 1.5;
            g.beginPath();
            g.roundRect(x, (height - h) / 2, 3, h, r);
            g.fill();
          }
          g.globalAlpha = 1;
          raf = requestAnimationFrame(draw);
        };
        draw();
      } catch {
        if (!cancelled) setMicFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [mode, height]);

  if (mode === "ambient" || micFailed) return <AmbientBars height={height} />;
  return <canvas ref={canvasRef} className="w-full" style={{ height }} />;
}
