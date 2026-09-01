// قراءة نصّ المقابلة المحفوظ وعرضه كمحادثة.
//
// task_specs.interview_messages تُخزَّن بصيغة رسائل Anthropic الخام: محتوى
// المساعد مصفوفة كتل (تفكير، نص، استدعاء أداة)، ومحتوى المستخدم نصّ أو كتل
// نتائج أدوات. ما يهمّ العرض هو كتل النص وحدها.

export interface TranscriptMsg {
  role: "user" | "assistant";
  text: string;
}

/** خيارات سريعة بصيغة [[خيارات: أ | ب]] — تُعرض أزرارًا وتُخفى من النص */
export const OPTIONS_RE = /\[\[خيارات:([^\]]*)\]\]/;

export function extractOptions(text: string): string[] {
  const m = text.match(OPTIONS_RE);
  if (!m) return [];
  return m[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function cleanText(text: string): string {
  // يزيل الصيغة كاملة أو ناقصة أثناء البث حتى لا تومض للمستخدم
  return text.replace(OPTIONS_RE, "").replace(/\[\[خيارات:[^\]]*$/, "").trimEnd();
}

interface RawBlock {
  type?: string;
  text?: string;
}
interface RawMsg {
  role?: string;
  content?: string | RawBlock[];
}

/** يحوّل رسائل المقابلة الخام إلى محادثة صالحة للعرض */
export function toTranscript(raw: unknown): TranscriptMsg[] {
  if (!Array.isArray(raw)) return [];
  const out: TranscriptMsg[] = [];

  for (const m of raw as RawMsg[]) {
    if (m?.role !== "user" && m?.role !== "assistant") continue;

    const text =
      typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .filter((b) => b?.type === "text" && typeof b.text === "string")
              .map((b) => b.text as string)
              .join("")
          : "";

    // رسائل نتائج الأدوات تصل بدور «user» بلا نصّ — تُسقَط فلا تظهر فراغات
    const clean = cleanText(text).trim();
    if (clean) out.push({ role: m.role, text: clean });
  }

  return out;
}

/** تطبيع النصّ قبل النطق — لا يمسّ النصّ المعروض.
 *  الرموز وعلامات التنسيق والأسطر الجديدة كلها بلا معنى في الأذن، وبعضها
 *  يُنطق حرفيًا («نجمة»، «شرطة») فيفضح أن ما تسمعه نصّ مقروء لا كلام. */
export function speechText(text: string): string {
  return cleanText(text)
    .replace(/[*_#`>]/g, "")                    // تنسيق ماركداون
    .replace(/^\s*[-••]\s*/gm, "")           // نقاط أول السطر
    .replace(/^\s*\d+[.)]\s*/gm, "")             // ترقيم أول السطر
    .replace(/[—–]/g, "،")                      // شرطة طويلة تصير فاصلة عربية
    .replace(/\n{2,}/g, ". ")                   // فقرة جديدة تصير وقفة
    .replace(/\n/g, "، ")                       // سطر جديد يصير فاصلة
    .replace(/\s{2,}/g, " ")
    .replace(/،\s*،/g, "،")                  // فواصل متتالية
    .trim();
}
