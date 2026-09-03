"use client";

// لوحة تفاصيل العقدة — تظهر أسفل الرسم عند النقر على عقدة.
//
// المسار يُبنى من كلام المستخدم، وما لم يُذكر يبقى فارغًا. وكان تصحيحه لا
// يتم إلا بجملة في المحادثة تُعيد التوليد كلَّه. هنا يفتح الحقل نفسه:
// يرى ما التُقط من كلامه، ويكتب ما نقص، فيُنشر إصدارٌ ويُعاد البناء.

import { useState } from "react";
import { PROVIDER_LABELS, type IRNode, type Provider } from "@/lib/types";
import { providerIcon } from "./icons";

interface Field {
  key: string;
  label: string;
  hint?: string;
}

// الحقول التي تُسأل عنها كل خدمة — بأسمائها كما يفهمها صاحب المهمة لا
// كما تسمّيها واجهة المزوّد
const FIELDS: Partial<Record<Provider, Field[]>> = {
  google_sheets: [
    { key: "spreadsheet_name", label: "اسم الجدول", hint: "مثال: منتجات" },
    { key: "sheet_name", label: "اسم الورقة", hint: "اتركه فارغًا للورقة الأولى" },
  ],
  google_drive: [
    { key: "file_name", label: "اسم الملف" },
    { key: "folder_name", label: "اسم المجلد" },
  ],
  google_docs: [{ key: "file_name", label: "اسم المستند" }],
  google_slides: [{ key: "file_name", label: "اسم العرض" }],
  google_calendar: [{ key: "calendar", label: "التقويم" }],
  gmail: [
    { key: "recipient", label: "المُرسَل إليه", hint: "بريد المستلم" },
    { key: "subject", label: "عنوان الرسالة" },
  ],
  telegram: [{ key: "chat_id", label: "معرّف المحادثة", hint: "يُملأ تلقائيًا من بوتك" }],
  slack: [{ key: "slack_channel", label: "القناة" }],
  instagram: [
    { key: "ig_user_id", label: "معرّف الحساب التجاري" },
    { key: "image_url", label: "رابط الصورة" },
  ],
  removebg: [{ key: "image_url", label: "رابط الصورة", hint: "اتركه فارغًا ليُقرأ من الخطوة السابقة" }],
};

const LABELS: Record<string, string> = {
  schedule: "الموعد",
  prompt: "التعليمات",
  spreadsheet_url: "معرّف الجدول",
  recipient: "المُرسَل إليه",
  chat_id: "معرّف المحادثة",
};

/** العقد النظامية (محفّز، نتيجة) لا تُعدّل حقولها — الخادم يرفضها بحق */
const EDITABLE = /^step-\d+$/;

export default function NodeInspector({
  node,
  flowId,
  onSaved,
  onClose,
}: {
  node: IRNode;
  flowId: string;
  /** حُفظ التعديل وأُعيد البناء — تعيد الشاشة قراءة الرسم */
  onSaved: () => void;
  onClose: () => void;
}) {
  const editable = EDITABLE.test(node.id);
  const known = (node.provider && FIELDS[node.provider]) || [];
  // ما التقطه النموذج ولم يكن في القائمة يظهر أيضًا — لا نُخفي عن المستخدم
  // قيمةً تؤثّر في مساره لمجرّد أننا لم نتوقّعها
  const extras = Object.keys(node.params).filter(
    (k) => !known.some((f) => f.key === k)
  );
  const fields: Field[] = [
    ...known,
    ...extras.map((k) => ({ key: k, label: LABELS[k] ?? k })),
  ];

  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  // تبديل العقدة يعيد ملء الحقول من قيمها هي — أثناء العرض لا في تأثير،
  // فالتأثير يرسم حقول العقدة السابقة إطارًا ثم يستبدلها فتومض
  const [filledFor, setFilledFor] = useState<string | null>(null);
  if (filledFor !== node.id) {
    setFilledFor(node.id);
    const init: Record<string, string> = {};
    fields.forEach((f) => (init[f.key] = node.params[f.key] ?? ""));
    setValues(init);
    setNote(null);
  }

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const clean: Record<string, string> = {};
      Object.entries(values).forEach(([k, v]) => {
        if (v.trim()) clean[k] = v.trim();
      });

      const r = await fetch(`/api/flows/${flowId}/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id, params: clean }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "تعذّر الحفظ");

      // الحفظ ينشر إصدارًا؛ والبناء هو ما يُنزله إلى المحرك فعلًا
      const b = await fetch(`/api/flows/${flowId}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const bd = await b.json().catch(() => ({}));
      if (!b.ok) throw new Error(bd.error ?? "حُفظ التعديل وتعذّر البناء");

      setNote({
        ok: true,
        text:
          bd.status === "NeedsInformation"
            ? "حُفظ — وما زال ينقص المسار معلومة"
            : "حُفظ وأُعيد البناء ✓",
      });
      onSaved();
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "خطأ" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-t border-[var(--line)] bg-[var(--panel-solid)] px-4 py-3 max-h-[42%] overflow-y-auto shrink-0">
      <header className="flex items-center gap-2 mb-3">
        {node.provider && (
          <span className="shrink-0">{providerIcon(node.provider, 18)}</span>
        )}
        <span className="font-bold text-[0.88rem] truncate min-w-0">{node.label}</span>
        {node.provider && (
          <span className="text-[0.7rem] text-[var(--text-soft)] shrink-0">
            {PROVIDER_LABELS[node.provider]}
          </span>
        )}
        <button
          onClick={onClose}
          title="إغلاق"
          className="ms-auto shrink-0 text-[var(--text-soft)] hover:text-[var(--text)]"
        >
          ✕
        </button>
      </header>

      {node.description && (
        <p className="text-[0.78rem] leading-relaxed text-[var(--text-soft)] mb-3">
          {node.description}
        </p>
      )}

      {!editable ? (
        <p className="text-[0.75rem] text-[var(--text-soft)]">
          عقدة نظامية — تُعدَّل خطوات المهمة وحدها.
        </p>
      ) : fields.length === 0 ? (
        <p className="text-[0.75rem] text-[var(--text-soft)]">
          لا حقول لهذه الخطوة.
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 min-w-0">
                <span className="text-[0.72rem] font-semibold">{f.label}</span>
                <input
                  className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.8rem] focus:border-[var(--accent-bg)] outline-none"
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  placeholder={f.hint ?? ""}
                  disabled={busy}
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={save}
              disabled={busy}
              className="btn btn-primary text-[0.75rem] py-1.5"
            >
              {busy ? "جارٍ الحفظ…" : "حفظ وإعادة البناء"}
            </button>
            {note && (
              <span
                className={`text-[0.73rem] ${
                  note.ok ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {note.text}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
