"use client";

// دعم اللغتين: عربي (افتراضي RTL) وإنجليزي (LTR) — قاموس واجهة خفيف + حدث تبديل حي

import { useEffect, useState } from "react";

export type Lang = "ar" | "en";

const DICT: Record<string, { ar: string; en: string }> = {
  brand: { ar: "وَتيرة", en: "Wateera" },
  "nav.chat": { ar: "المحادثة", en: "Chat" },
  "tab.create": { ar: "إنشاء", en: "Create" },
  "tab.flows": { ar: "سير العمل", en: "Workflow" },
  "wf.yours": { ar: "مساراتك", en: "Your flows" },
  "rail.new": { ar: "محادثة جديدة", en: "New chat" },
  "rail.menu": { ar: "خيارات", en: "Options" },
  "rail.rename": { ar: "إعادة تسمية", en: "Rename" },
  "rail.delete": { ar: "حذف", en: "Delete" },
  "rail.deleteYes": { ar: "نعم، احذف", en: "Yes, delete" },
  "rail.cancel": { ar: "إلغاء", en: "Cancel" },
  "rail.confirmDelete": { ar: "يُحذف المسار وسجلّه نهائيًا.", en: "The flow and its history are permanently removed." },
  "rail.collapse": { ar: "طيّ الشريط", en: "Collapse" },
  "rail.expand": { ar: "توسيع الشريط", en: "Expand" },
  "wf.pick": { ar: "اختر مسارًا لمعاينة بنيته وتفاصيله.", en: "Pick a flow to preview its structure." },
  "wf.preview": { ar: "معاينة منطق المسار والاتصالات", en: "Flow logic and connections preview" },
  "wf.open": { ar: "افتح المسار كاملًا ←", en: "Open full flow →" },
  "wf.empty": { ar: "لا توجد مسارات بعد — ابدأ من «إنشاء».", en: "No flows yet — start from Create." },
  "wf.promptEdit": { ar: "تعديل تعليمات الذكاء الاصطناعي", en: "Edit AI instructions" },
  "wf.promptHint": {
    ar: "عدّل نص التوجيه فقط — يُحفظ كإصدار جديد ثم أعد البناء.",
    en: "Edit the prompt text only — saved as a new version, then rebuild.",
  },
  "wf.save": { ar: "حفظ", en: "Save" },
  "wf.saved": { ar: "حُفظ كإصدار جديد ✓", en: "Saved as a new version ✓" },
  "wf.noPrompt": {
    ar: "هذه العقدة لا تحتوي تعليمات نصية قابلة للتعديل.",
    en: "This node has no editable prompt.",
  },
  "nav.progress": { ar: "إنجازاتي", en: "Progress" },
  "nav.settings": { ar: "الإعدادات والاتصالات", en: "Settings & connections" },
  "nav.theme.dark": { ar: "الوضع الداكن", en: "Dark mode" },
  "nav.theme.light": { ar: "الوضع الفاتح", en: "Light mode" },
  "nav.signout": { ar: "خروج", en: "Sign out" },
  "nav.account": { ar: "حسابك", en: "Your account" },
  "gmail.connect": { ar: "اربط Gmail", en: "Connect Gmail" },
  "gmail.connected": { ar: "Gmail متصل", en: "Gmail connected" },
  "gmail.disconnect": { ar: "افصل ربط Gmail", en: "Disconnect Gmail" },
  "gmail.done": { ar: "تم ربط Gmail بنجاح.", en: "Gmail connected successfully." },
  "gmail.removed": { ar: "فُصل ربط Gmail.", en: "Gmail disconnected." },
  "gmail.reconnect": { ar: "أعد ربط Gmail", en: "Reconnect Gmail" },
  "drawer.gmailOwn": {
    ar: "أو اربط حساب Gmail الخاص بك مباشرة (قراءة وإرسال):",
    en: "Or connect your own Gmail account directly (read & send):",
  },
  "gmail.expired": {
    ar: "انتهت صلاحية ربط Gmail — أعد الربط.",
    en: "Gmail authorization expired — reconnect.",
  },
  "home.w1": { ar: "تحدث", en: "Talk" },
  "home.w2": { ar: "اربط", en: "Connect" },
  "home.w3": { ar: "أتمت", en: "Automate" },
  "home.sub": { ar: "صف مهمتك بجملة — أو اضغط المايك وتكلّم.", en: "Describe your task in one line — or tap the mic and talk." },
  "home.try": { ar: "جرّب مثلًا:", en: "Try for example:" },
  "home.flows": { ar: "مساراتك", en: "Your flows" },
  "input.placeholder": {
    ar: "صف المهمة التي تريد أتمتتها…",
    en: "Describe the task you want to automate…",
  },
  "input.attach": { ar: "أرفق ملفات (حتى 3)", en: "Attach files (up to 3)" },
  "input.talk": { ar: "تحدّث", en: "Talk" },
  "input.stopVoice": { ar: "أوقف التسجيل", en: "Stop recording" },
  "input.send": { ar: "إرسال", en: "Send" },
  "input.listening": { ar: "نسمعك…", en: "Listening…" },
  "opts.other": { ar: "أخرى — أكتبها بنفسي", en: "Other — I'll type it" },
  "opts.otherPlaceholder": { ar: "اكتب إجابتك هنا…", en: "Type your answer here…" },
  "voice.speaking": { ar: "وَتيرة يتحدث", en: "Wateera is speaking" },
  "voice.back": { ar: "العودة للمحادثة", en: "Back to chat" },
  "voice.title": { ar: "محادثة الأتمتة", en: "Automation chat" },
  "voice.intro": {
    ar: "هلا. قل لي وش الشغلة اللي تكررها كل يوم وأنا أسويها لك؟",
    en: "Hey. What's the task you repeat every day that I can take off your hands?",
  },
  "voice.continuous": {
    ar: "تكلم عادي، أنا معك",
    en: "Just talk — I'm with you",
  },
  "voice.listening": { ar: "أسمعك", en: "I'm listening" },
  "voice.talking": { ar: "", en: "" },
  "voice.processing": { ar: "ثانية… أفكر", en: "One sec…" },
  "voice.transcribing": { ar: "ثانية… أفكر", en: "One sec…" },
  "voice.noSpeech": { ar: "ما سمعتك زين… عيدها؟", en: "I didn't catch that — say it again?" },
  "voice.hiccup": { ar: "لحظة، صار عندي خلل بسيط", en: "One moment — small hiccup" },
  "voice.paused": { ar: "توقفت — دقّ الكرة نكمل", en: "Paused — tap the orb to continue" },
  "voice.resume": { ar: "متابعة الاستماع", en: "Resume listening" },
  "voice.complete": { ar: "تمام، خلصنا", en: "All set" },
  "voice.unsupported": {
    ar: "متصفحك لا يدعم المحادثة الصوتية",
    en: "Your browser does not support voice chat",
  },
  "spec.ready": { ar: "المواصفة جاهزة للتقييم.", en: "Spec is ready for evaluation." },
  "spec.showEval": { ar: "اعرض التقييم ←", en: "Show evaluation →" },
  "stats.active": { ar: "مسار مفعّل يعمل عنك", en: "Active flows working for you" },
  "stats.done": { ar: "مهمة أُنجزت تلقائيًا", en: "Tasks done automatically" },
  "stats.rate": { ar: "معدل النجاح", en: "Success rate" },
  "stats.rateWait": { ar: "بانتظار أول تشغيلة", en: "Awaiting first run" },
  "stats.hours": { ar: "رجعت لك من وقتك", en: "Hours back in your day" },
  "stats.hoursUnit": { ar: "ساعة", en: "hrs" },
  "drawer.title": { ar: "الإعدادات", en: "Settings" },
  "drawer.connections": { ar: "الاتصالات", en: "Connections" },
  "drawer.prefs": { ar: "التفضيلات", en: "Preferences" },
  "drawer.connect": { ar: "+ اربط", en: "+ Connect" },
  "drawer.disconnect": { ar: "فصل", en: "Disconnect" },
  "drawer.connectMine": { ar: "ربط بحسابي", en: "Connect my account" },
  "drawer.platformCred": { ar: "اعتماد المنصة", en: "Platform account" },
  "drawer.connecting": { ar: "نربط...", en: "Connecting..." },
  "drawer.speak": { ar: "نطق الردود صوتيًا", en: "Speak replies aloud" },
  "drawer.on": { ar: "مفعّل", en: "On" },
  "drawer.off": { ar: "متوقف", en: "Off" },
  "drawer.lang": { ar: "اللغة", en: "Language" },
  "drawer.signout": { ar: "تسجيل الخروج", en: "Sign out" },
  "drawer.googleNote": {
    ar: "حسابات Google ترتبط عبر حساب المنصة الموثّق بضغطة واحدة. التوكنات تُحفظ مشفّرة في خزنة المحرك — لا تمر على المنصة.",
    en: "Google accounts connect via the platform's verified account in one click. Tokens are stored encrypted in the engine vault — they never touch the platform.",
  },
  "prog.today": { ar: "اليوم", en: "Today" },
  "prog.headline": { ar: "اليوم: الأتمتة قفلت لك", en: "Today: automation closed" },
  "prog.task1": { ar: "مهمة", en: "task" },
  "prog.taskN": { ar: "مهام", en: "tasks" },
  "prog.chart": { ar: "مهام أقفلتها الأتمتة — آخر ٧ أيام", en: "Tasks closed by automation — last 7 days" },
  "prog.level": { ar: "مستواك:", en: "Your level:" },
  "prog.totalClosed": { ar: "مهمة مقفلة إجمالًا", en: "tasks closed in total" },
  "prog.plan": { ar: "خطتك القادمة", en: "Your next plan" },
  "prog.ideas": { ar: "أفكار جاهزة للأتمتة", en: "Ready automation ideas" },
  "prog.ideasSub": {
    ar: "اضغط أي فكرة لتبدأ بها محادثة جديدة",
    en: "Tap an idea to start a new chat with it",
  },
  "diagram.tasks": { ar: "مهامك المتكررة", en: "Your recurring tasks" },
  "diagram.done": { ar: "أُنجزت تلقائيًا", en: "Auto-completed" },
  "diagram.time": { ar: "ساعة موفَّرة", en: "Hours saved" },
  "diagram.active": { ar: "مسار يعمل عنك", en: "Active flows" },
  "chart.asTable": { ar: "عرض البيانات كجدول ◂", en: "View data as table ▸" },
  "flow.back": { ar: "→ الرئيسية", en: "← Home" },
};

export function getLang(): Lang {
  if (typeof document === "undefined") return "ar";
  return document.documentElement.lang === "en" ? "en" : "ar";
}

export const DOC_TITLE = {
  ar: "وَتيرة — من وصف المهمة إلى أتمتة تعمل",
  en: "Wateera — from a described task to a working automation",
} as const;

export function applyLang(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
  document.title = DOC_TITLE[lang];
  try {
    localStorage.setItem("simat_lang", lang);
  } catch {}
  window.dispatchEvent(new CustomEvent("simat-lang", { detail: lang }));
}

export function toggleLang(): Lang {
  const next: Lang = getLang() === "ar" ? "en" : "ar";
  applyLang(next);
  return next;
}

export function useLang() {
  const [lang, setLang] = useState<Lang>("ar");
  useEffect(() => {
    // بعد الترطيب: نعيد ضبط العنوان لأن بيانات Next الثابتة تدهس ما ضبطه سكربت الإقلاع
    const boot = getLang();
    setLang(boot);
    document.title = DOC_TITLE[boot];
    const on = (e: Event) => {
      const next = (e as CustomEvent<Lang>).detail;
      setLang(next);
      document.title = DOC_TITLE[next];
    };
    window.addEventListener("simat-lang", on);
    return () => window.removeEventListener("simat-lang", on);
  }, []);
  const t = (key: string) => DICT[key]?.[lang] ?? DICT[key]?.ar ?? key;
  return { lang, t };
}
