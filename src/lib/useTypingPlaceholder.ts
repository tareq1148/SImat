"use client";

// نصّ متبدّل في خانة الكتابة: يُكتب حرفًا حرفًا، يمكث، يُمحى، ثم يليه غيره.
// الغرض تعليمي لا زخرفي — الأمثلة مسارات تعمل فعلًا على التكاملات المدعومة،
// فيعرف المستخدم ما الذي يصلح أن يُطلب قبل أن يكتب.

import { useEffect, useRef, useState } from "react";

const TYPE_MS = 45;
const ERASE_MS = 22;
const HOLD_MS = 1800;
const GAP_MS = 400;

export const PROMPT_SAMPLES_AR = [
  "كل أحد الساعة ٩ صباحًا أرسل لي ملخص مهام الأسبوع على الإيميل",
  "كل يوم اقرأ إيميلاتي الجديدة ولخّصها لي في رسالة واحدة",
  "شيل خلفية صور المنتجات من جدول الشيت وارفعها على درايف",
  "كل يوم اثنين سوّ لي عرض تقديمي بأرقام المبيعات من الجدول",
  "ضيف موعد في تقويم جوجل لمتابعة العملاء كل ثلاثاء الساعة ١١",
  "كل صباح اكتب لي مستند فيه خطة اليوم واحفظه في درايف",
];

export const PROMPT_SAMPLES_EN = [
  "Every Sunday at 9am, email me a summary of this week's tasks",
  "Read my new emails daily and summarise them in one message",
  "Remove the background from product photos and upload them to Drive",
  "Build a weekly slide deck from the sales numbers in my sheet",
  "Add a Google Calendar event to follow up with clients every Tuesday",
  "Write a daily plan document each morning and save it to Drive",
];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * يرجع النصّ المعروض في placeholder. متى تعطّل — أو طلب المستخدم تقليل
 * الحركة — يعود النصّ الثابت كما هو.
 */
export function useTypingPlaceholder(
  samples: string[],
  enabled: boolean,
  fallback: string
): string {
  const [text, setText] = useState("");
  // الفهرس يعيش في ref لا في state: تقدّمه لا يعني إعادة تشغيل المؤقّت
  const indexRef = useRef(0);

  useEffect(() => {
    if (!enabled || samples.length === 0 || prefersReducedMotion()) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let pos = 0;
    let erasing = false;

    const tick = () => {
      if (!alive) return;
      const full = samples[indexRef.current % samples.length];

      if (!erasing) {
        pos += 1;
        setText(full.slice(0, pos));
        if (pos >= full.length) {
          erasing = true;
          timer = setTimeout(tick, HOLD_MS);
          return;
        }
        timer = setTimeout(tick, TYPE_MS);
        return;
      }

      pos -= 1;
      setText(full.slice(0, Math.max(pos, 0)));
      if (pos <= 0) {
        erasing = false;
        indexRef.current += 1;
        timer = setTimeout(tick, GAP_MS);
        return;
      }
      timer = setTimeout(tick, ERASE_MS);
    };

    timer = setTimeout(tick, GAP_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
      setText("");
    };
  }, [enabled, samples]);

  if (!enabled || prefersReducedMotion()) return fallback;
  // بين مثال وآخر تكون الخانة فارغة لحظة — النصّ الثابت يسدّها فلا تومض بيضاء
  return text || fallback;
}
