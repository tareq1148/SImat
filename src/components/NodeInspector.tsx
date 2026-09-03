"use client";

// لوحة تفاصيل العقدة — تظهر أسفل الرسم عند النقر على عقدة.
//
// المسار يُبنى من كلام المستخدم، وما لم يُذكر يبقى فارغًا. وكان تصحيحه لا
// يتم إلا بجملة في المحادثة تُعيد التوليد كلَّه. هنا يفتح الحقل نفسه:
// يرى ما التُقط من كلامه، ويكتب ما نقص، فيُنشر إصدارٌ ويُعاد البناء.

import { useEffect, useState } from "react";
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
  // الجدول نفسه يُنتقى من حسابه لا يُكتب — انظر SheetPicker أدناه
  google_sheets: [
    { key: "sheet_name", label: "اسم الورقة", hint: "اتركه فارغًا للورقة الأولى" },
  ],
  // المجلّد يُنتقى لا يُكتب — انظر ResourcePicker أدناه
  google_drive: [{ key: "file_name", label: "اسم الملف" }],
  google_docs: [{ key: "title", label: "اسم المستند" }],
  google_slides: [{ key: "title", label: "اسم العرض" }],
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
  file_name: "اسم الملف",
  title: "الاسم",
};

/** من ينتقي مجلّد الحفظ: كل ما يكتب في درايف — رفعًا أو إنشاءً */
const FOLDER_PROVIDERS = new Set<Provider>([
  "google_drive",
  "google_docs",
]);

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
  const isSheets = node.provider === "google_sheets";
  const hasFolder = !!node.provider && FOLDER_PROVIDERS.has(node.provider);
  const HIDDEN = [
    ...(isSheets ? ["spreadsheet_name", "spreadsheet_url"] : []),
    ...(hasFolder ? ["folder_name", "folder_id"] : []),
  ];
  const extras = Object.keys(node.params).filter(
    (k) => !known.some((f) => f.key === k) && !HIDDEN.includes(k)
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
          {isSheets && (
            <ResourcePicker
              kind="sheet"
              label="الجدول"
              createHint="اسم الجدول الجديد"
              emptyHint="ما لقيت جداول في حسابك — أنشئ واحدًا."
              name={values.spreadsheet_name ?? ""}
              id={values.spreadsheet_url ?? ""}
              disabled={busy}
              onPick={(picked) =>
                setValues((v) => ({
                  ...v,
                  spreadsheet_name: picked.name,
                  // المعرّف يُثبَّت مع الاسم: لا بحثَ ولا التباسَ عند البناء
                  spreadsheet_url: picked.id,
                }))
              }
            />
          )}

          {hasFolder && (
            <ResourcePicker
              kind="folder"
              label="مجلّد الحفظ"
              createHint="اسم المجلد الجديد"
              emptyHint="ما لقيت مجلدات — أنشئ واحدًا، أو اتركه فيُحفظ في جذر درايفك."
              name={values.folder_name ?? ""}
              id={values.folder_id ?? ""}
              disabled={busy}
              onPick={(picked) =>
                setValues((v) => ({
                  ...v,
                  folder_name: picked.name,
                  folder_id: picked.id,
                }))
              }
            />
          )}

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

/**
 * منتقي الجدول: يعرض جداول الحساب المربوط ليختار منها، ويُنشئ جديدًا عند
 * الطلب. كتابةُ الاسم يدويًا كانت تراهن على أن ما يكتبه يطابق ما في درايفه،
 * فإن أخطأ حرفًا وقف المسار ولا يدري لماذا. وهنا لا مجال للخطأ: ما يظهر
 * موجود، وما ليس موجودًا يُصنع بضغطة.
 */
function ResourcePicker({
  kind,
  label,
  createHint,
  emptyHint,
  name,
  id,
  disabled,
  onPick,
}: {
  kind: "sheet" | "folder";
  label: string;
  createHint: string;
  emptyHint: string;
  name: string;
  id: string;
  disabled: boolean;
  onPick: (picked: { id: string; name: string }) => void;
}) {
  const [items, setItems] = useState<{ id: string; name: string }[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/google/files?kind=${kind}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setItems(Array.isArray(d.files) ? d.files : []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [kind]);

  async function create() {
    const title = newName.trim();
    if (!title) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/google/files?kind=${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "تعذّر الإنشاء");
      setItems((s) => [{ id: d.id, name: d.name }, ...(s ?? [])]);
      onPick({ id: d.id, name: d.name });
      setCreating(false);
      setNewName("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  }

  // الاسم الملتقط من الكلام قد لا يقابله معرّف بعد — يُعرض خيارًا مؤقتًا
  // بدل أن يختفي فيظنّ المستخدم أن اختياره ضاع
  const options = items ?? [];
  const unlisted = name && !options.some((o) => o.name === name || o.id === id);

  return (
    <div className="mb-3 flex flex-col gap-1">
      <span className="text-[0.72rem] font-semibold">{label}</span>

      {!creating ? (
        <div className="flex items-center gap-2">
          <select
            className="flex-1 min-w-0 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.8rem] focus:border-[var(--accent-bg)] outline-none"
            value={id || (unlisted ? "__unlisted__" : "")}
            disabled={disabled || items === null}
            onChange={(e) => {
              const picked = options.find((o) => o.id === e.target.value);
              if (picked) onPick(picked);
            }}
          >
            {items === null && <option value="">جارٍ القراءة…</option>}
            {items !== null && <option value="">اختر…</option>}
            {unlisted && <option value="__unlisted__">{name} (لم يُطابَق بعد)</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={disabled}
            className="btn btn-ghost text-[0.72rem] py-1.5 shrink-0"
            title="ينشئ واحدًا جديدًا في حسابك ويثبّته في هذه الخطوة"
          >
            جديد
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="flex-1 min-w-0 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.8rem] focus:border-[var(--accent-bg)] outline-none"
            placeholder={createHint}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") setCreating(false);
            }}
            disabled={busy}
          />
          <button
            type="button"
            onClick={create}
            disabled={busy || !newName.trim()}
            className="btn btn-primary text-[0.72rem] py-1.5 shrink-0"
          >
            {busy ? "…" : "أنشئ"}
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            disabled={busy}
            className="btn btn-ghost text-[0.72rem] py-1.5 shrink-0"
          >
            إلغاء
          </button>
        </div>
      )}

      {err && <span className="text-[0.72rem] text-amber-600">{err}</span>}
      {items !== null && items.length === 0 && !creating && (
        <span className="text-[0.72rem] text-[var(--text-soft)]">{emptyHint}</span>
      )}
    </div>
  );
}
