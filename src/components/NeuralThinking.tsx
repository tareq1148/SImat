"use client";

// مؤشّر انتظار بسيط: كلمة تتوهّج. حلّ محلّ شبكة عصبية متحرّكة كانت تشغل
// مساحة كبيرة وتسرد ما يجري بأربع جمل متبدّلة — والانتظار لا يحتاج شرحًا.
// أُبقيت الواجهة (phase) كما هي فلا تتغيّر مواضع الاستدعاء.

import { useLang } from "@/lib/i18n";

type Phase = "thinking" | "evaluating" | "building";

export default function NeuralThinking({ phase }: { phase: Phase }) {
  const { lang } = useLang();
  const label = lang === "en" ? "Thinking…" : "يفكّر…";

  return (
    <span className="think-glow" role="status" aria-live="polite" data-phase={phase}>
      {label}
    </span>
  );
}
