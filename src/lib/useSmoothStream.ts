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

  const flush = () => {
    shown = target.length;
    onText(target);
  };

  const tick = () => {
    const remaining = target.length - shown;
    if (remaining > 0) {
      // نحو عُشر المتبقّي في كل إطار: تسارعٌ لطيف يذيب التراكم بلا وثبة
      shown = Math.min(target.length, shown + Math.max(1, Math.round(remaining / 10)));
      onText(target.slice(0, shown));
    }
    // يتوقّف حين يلحق المعروضُ بالهدف ولا مزيد قادم
    if (!streaming && shown >= target.length) {
      raf = 0;
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
    },
    push(chunk: string) {
      target += chunk;
      if (prefersReducedMotion()) {
        flush();
        return;
      }
      ensureRunning();
    },
    finish() {
      streaming = false;
      if (prefersReducedMotion()) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        flush();
        return;
      }
      if (shown < target.length) ensureRunning();
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
