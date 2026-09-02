"use client";

// شبكة عصبية حية وتفاعلية — عُقد تسبح وخطوط تتشكل بينها، وتتفاعل مع مؤشر الفأرة/اللمس
// ألوان الهوية: ليموني → أخضر → سماوي → أزرق

import { useEffect, useRef } from "react";

const COLORS = ["#cfff00", "#8ed91d", "#58ed32", "#20cbd0", "#38bdf8", "#2874f0"];

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
}

export default function NeuralField({
  height = 420,
}: {
  height?: number | string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    let w = 0;
    let h = typeof height === "number" ? height : 420;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pointer = { x: -999, y: -999 };
    let dots: Dot[] = [];

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const seed = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight || (typeof height === "number" ? height : 420);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(26, Math.min(64, Math.round((w * h) / 9000)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: 1.8 + Math.random() * 3.4,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
      }));
    };

    const draw = () => {
      g.clearRect(0, 0, w, h);

      // خطوط بين العقد المتقاربة
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i];
          const b = dots[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 118) {
            g.strokeStyle = a.c;
            g.globalAlpha = (1 - d / 118) * 0.34;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
            g.stroke();
          }
        }
      }

      // العقد + تفاعل المؤشر
      for (const p of dots) {
        const dp = Math.hypot(p.x - pointer.x, p.y - pointer.y);
        const near = dp < 130;
        if (near) {
          // تنجذب برفق نحو المؤشر ويكبر حجمها
          p.x += (pointer.x - p.x) * 0.012;
          p.y += (pointer.y - p.y) * 0.012;
          g.strokeStyle = p.c;
          g.globalAlpha = (1 - dp / 130) * 0.5;
          g.lineWidth = 1.1;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(pointer.x, pointer.y);
          g.stroke();
        }
        g.globalAlpha = near ? 1 : 0.85;
        g.fillStyle = p.c;
        g.beginPath();
        g.arc(p.x, p.y, near ? p.r * 1.5 : p.r, 0, Math.PI * 2);
        g.fill();

        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    seed();
    draw();

    const onResize = () => seed();
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = -999;
      pointer.y = -999;
    };

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [height]);

  return (
    <canvas
      ref={ref}
      style={{ height }}
      className="w-full touch-none"
      aria-hidden
    />
  );
}
