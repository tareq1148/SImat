"use client";

// دعم اللغتين: عربي (افتراضي RTL) وإنجليزي (LTR) — قاموس واجهة خفيف + حدث تبديل حي

import { useEffect, useState } from "react";

export type Lang = "ar" | "en";

const DICT: Record<string, { ar: string; en: string }> = {
  brand: { ar: "وَتيرة", en: "وَتيرة" },
  "nav.chat": { ar: "المحادثة", en: "Chat" },
  "tab.create": { ar: "إنشاء", en: "Create" },
  "tab.flows": { ar: "سير العمل", en: "Workflow" },
  "wf.yours": { ar: "مساراتك", en: "Your flows" },
  "rail.new": { ar: "محادثة جديدة", en: "New chat" },
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
  "voice.speaking": { ar: "وَتيرة يتحدث", en: "وَتيرة is speaking" },
  "voice.back": { ar: "العودة للمحادثة", en: "Back to chat" },
  "voice.title": { ar: "محادثة الأتمتة", en: "Automation chat" },
  "voice.intro": {
    ar: "صف لي المهمة التي تريد أتمتتها.",
    en: "Describe the task you want to automate.",
  },
  "voice.continuous": {
    ar: "استماع مستمر — تحدّث بطبيعتك",
    en: "Always listening — just speak naturally",
  },
  "voice.listening": { ar: "يستمع…", en: "Listening…" },
  "voice.talking": { ar: "يتحدث…", en: "Speaking…" },
  "voice.processing": { ar: "يحلل الوكيل إجابتك…", en: "Analyzing your answer…" },
  "voice.transcribing": { ar: "يعالج الإجابة…", en: "Processing…" },
  "voice.paused": { ar: "موقوف — اضغط الكرة للمتابعة", en: "Paused — tap the orb to resume" },
  "voice.resume": { ar: "متابعة الاستماع", en: "Resume listening" },
  "voice.complete": { ar: "اكتمل تحديد الأتمتة", en: "Automation defined" },
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

export function applyLang(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
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
    setLang(getLang());
    const on = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener("simat-lang", on);
    return () => window.removeEventListener("simat-lang", on);
  }, []);
  const t = (key: string) => DICT[key]?.[lang] ?? DICT[key]?.ar ?? key;
  return { lang, t };
}
