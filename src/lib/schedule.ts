// ترجمة موعد المستخدم إلى قاعدة يفهمها مؤقّت n8n.
//
// المقابلة تلتقط الموعد كما ينطقه صاحبه: «كل دقيقتين»، «يوميًا ٨ صباحًا»،
// «كل أحد الساعة ٩». وهذا نصٌّ لا يفهمه المحرّك، فيُحوَّل هنا إلى بنية
// scheduleTrigger. وما عجزنا عن قراءته يقع على «يوميًا ٨ صباحًا» — لأن
// مسارًا يعمل في موعدٍ مقارب خيرٌ من مسارٍ لا يعمل أبدًا.

/** بنية قاعدة مؤقّت n8n — عنصر واحد في interval يكفي لكل مواعيدنا */
export interface ScheduleRule {
  interval: Array<Record<string, string | number | number[]>>;
}

/** أيام الأسبوع كما يرقّمها n8n: الأحد صفر */
const DAYS: Array<[RegExp, number]> = [
  [/أحد|الاحد|sunday|sun/i, 0],
  [/[إا]ثنين|الاثنين|monday|mon/i, 1],
  [/ثلاثاء|tuesday|tue/i, 2],
  [/أربعاء|الاربعاء|wednesday|wed/i, 3],
  [/خميس|thursday|thu/i, 4],
  [/جمعة|جمعه|friday|fri/i, 5],
  [/سبت|saturday|sat/i, 6],
];

/** أسماء الأعداد التي تَرِد في الكلام بدل الأرقام */
const WORDS: Array<[RegExp, number]> = [
  [/ثلاث|ثلث/, 3],
  [/أربع|اربع/, 4],
  [/خمس/, 5],
  [/ست/, 6],
  [/سبع/, 7],
  [/ثمان/, 8],
  [/تسع/, 9],
  [/عشر/, 10],
];

/** الأرقام العربية‑الهندية إلى لاتينية، وتوحيد المسافات */
function normalize(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * العدد المرافق لوحدة زمنية. المثنّى العربي لا رقم فيه — «دقيقتين» اثنتان
 * وإن خلت الجملة من عدد — فيُقرأ من صيغة الكلمة لا من رقمٍ بجوارها.
 */
function amount(
  text: string,
  unit: RegExp,
  dual: RegExp,
  /** أسماء الأعداد تُقرأ إلا حين تكون جزءًا من اسمٍ آخر — «ثلاثاء» فيه «ثلاث» */
  allowWords = true
): number {
  if (dual.test(text)) return 2;
  // الوحدة تُلفّ في مجموعة: بدونها يبتلع البدل «|» بقيةَ النمط فيضيع الرقم
  const near = new RegExp(`(\\d+)\\s*(?:${unit.source})`).exec(text);
  if (near) return Math.max(1, parseInt(near[1], 10));
  const after = new RegExp(`(?:${unit.source})\\s*(\\d+)`).exec(text);
  if (after) return Math.max(1, parseInt(after[1], 10));
  if (allowWords) for (const [re, n] of WORDS) if (re.test(text)) return n;
  return 1;
}

/** ساعة اليوم ودقيقتها — «٨ صباحًا»، «الساعة ٢١:٣٠»، «٩ مساءً» */
function timeOfDay(text: string): { hour: number; minute: number } {
  let hour = 8;
  let minute = 0;
  // «ساعة:دقيقة» تُطلب أوّلًا مهما كان موضعها: لو تُركت بديلًا في نمطٍ واحد
  // لسبقها «الساعة ١٦» فضاعت الدقائق — البدل يفوز بالأسبق لا بالأطول
  const hm = /(\d{1,2})\s*[:٫.]\s*(\d{2})/.exec(text);
  const at = /الساعة\s*(\d{1,2})/.exec(text);
  const ampm = /(\d{1,2})\s*(?:صباح|مساء|ظهر|عصر|ليل|am|pm)/i.exec(text);
  if (hm) {
    hour = parseInt(hm[1], 10);
    minute = parseInt(hm[2], 10);
  } else if (at) {
    hour = parseInt(at[1], 10);
  } else if (ampm) {
    hour = parseInt(ampm[1], 10);
  }
  // المساء يزيد اثنتي عشرة ما لم تُذكر الساعة بنظام الأربع والعشرين
  if (/مساء|ليل|pm/i.test(text) && hour < 12) hour += 12;
  if (/صباح|صباحا|am/i.test(text) && hour === 12) hour = 0;
  if (hour > 23 || hour < 0) hour = 8;
  if (minute > 59 || minute < 0) minute = 0;
  return { hour, minute };
}

/** تعبير cron مكتوب صراحةً — خمسة حقول أو ستّة */
function asCron(text: string): ScheduleRule | null {
  const parts = text.split(" ");
  if (parts.length < 5 || parts.length > 6) return null;
  if (!parts.every((p) => /^[\d*/,\-?]+$/.test(p))) return null;
  return { interval: [{ field: "cronExpression", expression: text }] };
}

/**
 * يقرأ نصّ الموعد ويردّ قاعدة المؤقّت. لا يردّ null أبدًا: ما لم يُفهم
 * يصير موعدًا يوميًّا — الصمت التامّ أسوأ من موعدٍ يُصحَّح.
 */
export function parseSchedule(raw: string): ScheduleRule {
  const text = normalize(raw).toLowerCase();

  const cron = asCron(text);
  if (cron) return cron;

  // الثواني أوّلًا: «كل ٣٠ ثانية» أدقّ من أن تُقرأ دقائق
  if (/ثانية|ثواني|second/.test(text)) {
    const n = amount(text, /ثانية|ثواني|seconds?/, /ثانيتين/);
    return { interval: [{ field: "seconds", secondsInterval: n }] };
  }

  if (/دقيقة|دقائق|دقيقتين|minute/.test(text)) {
    // «ربع ساعة» و«نصف ساعة» تُكتبان أحيانًا مع لفظ الدقائق
    if (/ربع/.test(text)) return { interval: [{ field: "minutes", minutesInterval: 15 }] };
    if (/نصف/.test(text)) return { interval: [{ field: "minutes", minutesInterval: 30 }] };
    const n = amount(text, /دقيقة|دقائق|minutes?/, /دقيقتين/);
    return { interval: [{ field: "minutes", minutesInterval: n }] };
  }

  if (/ساعة|ساعات|ساعتين|hour/.test(text) && !/الساعة/.test(text)) {
    if (/ربع/.test(text)) return { interval: [{ field: "minutes", minutesInterval: 15 }] };
    if (/نصف/.test(text)) return { interval: [{ field: "minutes", minutesInterval: 30 }] };
    const n = amount(text, /ساعة|ساعات|hours?/, /ساعتين/);
    return { interval: [{ field: "hours", hoursInterval: n, triggerAtMinute: 0 }] };
  }

  // يومٌ بعينه ⇒ أسبوعيّ ولو لم تُذكر كلمة «أسبوع»
  const day = DAYS.find(([re]) => re.test(text));
  if (day || /أسبوع|اسبوع|أسابيع|اسابيع|week/.test(text)) {
    const { hour, minute } = timeOfDay(text);
    // مع اسم اليوم لا تُقرأ أسماء الأعداد: «كل ثلاثاء» أسبوعٌ واحد لا ثلاثة
    const n = amount(text, /أسبوع|اسبوع|أسابيع|اسابيع|weeks?/, /أسبوعين|اسبوعين/, !day);
    return {
      interval: [
        {
          field: "weeks",
          weeksInterval: n,
          triggerAtDay: [day ? day[1] : 0],
          triggerAtHour: hour,
          triggerAtMinute: minute,
        },
      ],
    };
  }

  if (/شهر|شهور|month/.test(text)) {
    const { hour, minute } = timeOfDay(text);
    const n = amount(text, /شهر|شهور|أشهر|months?/, /شهرين/);
    const dom = /(\d{1,2})\s*(?:من|في|of)/.exec(text);
    return {
      interval: [
        {
          field: "months",
          monthsInterval: n,
          triggerAtDayOfMonth: dom ? Math.min(31, parseInt(dom[1], 10)) : 1,
          triggerAtHour: hour,
          triggerAtMinute: minute,
        },
      ],
    };
  }

  // يوميّ — وهو أيضًا ملاذ ما لم يُفهم
  const { hour, minute } = timeOfDay(text);
  const n = amount(text, /يوم|أيام|ايام|days?/, /يومين/);
  return {
    interval: [
      {
        field: "days",
        daysInterval: n,
        triggerAtHour: hour,
        triggerAtMinute: minute,
      },
    ],
  };
}

/** وصفٌ عربيّ موجز للقاعدة — يُعرض للمستخدم ليتحقّق مما فُهم من كلامه */
export function describeRule(rule: ScheduleRule): string {
  const i = rule.interval[0] ?? {};
  const at = (h: unknown, m: unknown) =>
    ` الساعة ${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
  switch (i.field) {
    case "cronExpression":
      return `cron: ${i.expression}`;
    case "seconds":
      return `كل ${i.secondsInterval} ثانية`;
    case "minutes":
      return `كل ${i.minutesInterval} دقيقة`;
    case "hours":
      return `كل ${i.hoursInterval} ساعة`;
    case "weeks": {
      const names = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const d = Array.isArray(i.triggerAtDay) ? i.triggerAtDay[0] : 0;
      return `كل ${i.weeksInterval} أسبوع يوم ${names[d] ?? "الأحد"}${at(i.triggerAtHour, i.triggerAtMinute)}`;
    }
    case "months":
      return `كل ${i.monthsInterval} شهر يوم ${i.triggerAtDayOfMonth}${at(i.triggerAtHour, i.triggerAtMinute)}`;
    default:
      return `كل ${i.daysInterval} يوم${at(i.triggerAtHour, i.triggerAtMinute)}`;
  }
}
