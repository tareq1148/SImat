"use client";

// عرض انسيابي للنصّ الوارد من البثّ.
//
// الخادم يرسل دفعات غير منتظمة — كلمة ثم جملة ثم صمت — فإن كُتبت كما تصل
// ظهر النصّ يقفز. هنا تُجمع الدفعات في هدف، ويلحق به المعروض بخطوة كل إطار،
// فيسيل بوتيرة واحدة مهما تقطّعت الشبكة. الخطوة تتناسب مع المتبقّي: تُسرع
// إن تراكم كثيرٌ فلا تتخلّف، وتهدأ عند القليل فلا تقفز.

import { useEffect, useState } from "react";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export interface SmoothStream {
  /** يبدأ رسالة جديدة — يُصفّر الهدف والمعروض */
  begin: () => void;
  /** يضيف دفعة واردة إلى الهدف */
  push: (chunk: string) => void;
  /** انتهى الورود: يُترك المعروض يلحق بالهدف ثم يتوقّف */
  finish: () => void;
  /** يحبس المعروض: تتجمّع الدفعات ولا يظهر منها حرف */
  hold: () => void;
  /**
   * يطلق المحبوس. مع مدّة (ملّي ثانية) يُوزَّع الباقي عليها فينتهي النصّ
   * مع انتهائها — وهي مدّة النطق، فيسير الحرف مع الصوت. وبلا مدّة يعود
   * إلى وتيرته المعتادة.
   */
  release: (durationMs?: number) => void;
  /** يوقف الإطارات المعلّقة عند التفكيك */
  dispose: () => void;
  /** يحدّث المتلقّي — يُستدعى من تأثير لا أثناء العرض */
  setOnText: (fn: (text: string) => void) => void;
}

/** مصنع خارج المكوّن: دالّة الإطار تشير إلى نفسها بلا قيد الخطّافات */
function createStream(): SmoothStream {
  let onText: (text: string) => void = () => {};
  let target = "";
  let shown = 0;
  let raf = 0;
  let streaming = false;
  // محبوس: النصّ يتجمّع ولا يظهر — ينتظر بدء النطق
  let holding = false;
  // اللحظة التي يجب أن يكتمل عندها العرض — تُشتقّ من مدّة الصوت
  let paceEnd = 0;
  let lastT = 0;

  const flush = () => {
    shown = target.length;
    onText(target);
  };

  const tick = () => {
    const now = performance.now();
    const dt = lastT ? Math.max(1, now - lastT) : 16;
    lastT = now;

    const remaining = target.length - shown;
    if (remaining > 0) {
      // مع الصوت: يُقسَّم الباقي على ما بقي من زمن النطق فينتهيان معًا. وإن
      // تأخّر العرض حتى انقضى الصوت لحق دفعةً واحدة بدل أن يتخلّف.
      // وبلا صوت: نحو عُشر المتبقّي في كل إطار — تسارعٌ لطيف يذيب التراكم.
      const step = paceEnd
        ? Math.max(1, Math.ceil(remaining * (dt / Math.max(dt, paceEnd - now))))
        : Math.max(1, Math.round(remaining / 10));
      shown = Math.min(target.length, shown + step);
      onText(target.slice(0, shown));
    }
    // يتوقّف حين يلحق المعروضُ بالهدف ولا مزيد قادم
    if (!streaming && shown >= target.length) {
      raf = 0;
      lastT = 0;
      paceEnd = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const ensureRunning = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  return {
    begin() {
      if (raf) cancelAnimationFrame(raf);
      target = "";
      shown = 0;
      raf = 0;
      streaming = true;
      holding = false;
      paceEnd = 0;
      lastT = 0;
    },
    push(chunk: string) {
      target += chunk;
      if (holding) return;
      if (prefersReducedMotion()) {
        flush();
        return;
      }
      ensureRunning();
    },
    finish() {
      streaming = false;
      if (holding) return; // ينتظر إطلاقًا من المتصل — النطق أو مهلة أمانه
      if (prefersReducedMotion()) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        flush();
        return;
      }
      if (shown < target.length) ensureRunning();
    },
    hold() {
      holding = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    release(durationMs = 0) {
      if (!holding && !durationMs) return;
      holding = false;
      lastT = 0;
      // بلا مدّة — تعذّر النطق أو جهلنا طوله — تعود الوتيرة المعتادة
      paceEnd = durationMs > 0 ? performance.now() + durationMs : 0;
      if (prefersReducedMotion() && !durationMs) {
        flush();
        return;
      }
      if (shown < target.length || streaming) ensureRunning();
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      streaming = false;
    },
    setOnText(fn) {
      onText = fn;
    },
  };
}

export function useSmoothStream(onText: (text: string) => void): SmoothStream {
  // حالةٌ بتهيئة كسولة لا مرجع: تُنشأ مرّة، وقراءتها أثناء العرض مشروعة
  const [stream] = useState(createStream);

  useEffect(() => {
    stream.setOnText(onText);
  });

  useEffect(() => () => stream.dispose(), [stream]);

  return stream;
}
