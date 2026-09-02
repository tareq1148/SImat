"use client";

// شاشة البحث: خانة كتابة فوق، وتحتها وسوم يضيفها المستخدم.
// كل وسم قيدٌ يُضاف إلى ما قبله (و لا أو) — فيضيّق النتائج لا يوسّعها.

import { useMemo, useState } from "react";
import Link from "next/link";
import StatusChip from "./StatusChip";
import { providerIcon } from "./icons";
import {
  PROVIDER_LABELS,
  STATUS_LABELS,
  type FlowStatus,
  type Provider,
} from "@/lib/types";

export interface SearchFlow {
  id: string;
  name: string;
  status: FlowStatus;
  updatedAt: string;
  providers: Provider[];
}

type Tag =
  | { kind: "text"; value: string }
  | { kind: "provider"; value: Provider }
  | { kind: "status"; value: FlowStatus };

function tagLabel(t: Tag): string {
  if (t.kind === "provider") return PROVIDER_LABELS[t.value];
  if (t.kind === "status") return STATUS_LABELS[t.value];
  return t.value;
}

function tagKey(t: Tag): string {
  return `${t.kind}:${t.value}`;
}

export default function SearchView({ flows }: { flows: SearchFlow[] }) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);

  // لا تُقترح إلا الخدمات والحالات الموجودة فعلًا في مسارات المستخدم
  const available = useMemo(() => {
    const provs = new Set<Provider>();
    const stats = new Set<FlowStatus>();
    flows.forEach((f) => {
      f.providers.forEach((p) => provs.add(p));
      stats.add(f.status);
    });
    return { provs: [...provs], stats: [...stats] };
  }, [flows]);

  const addTag = (t: Tag) => {
    setTags((cur) => (cur.some((x) => tagKey(x) === tagKey(t)) ? cur : [...cur, t]));
    setQuery("");
  };

  const removeTag = (key: string) =>
    setTags((cur) => cur.filter((t) => tagKey(t) !== key));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flows.filter((f) => {
      // الوسوم قيود متراكمة: يجب أن تتحقّق كلّها
      for (const t of tags) {
        if (t.kind === "provider" && !f.providers.includes(t.value)) return false;
        if (t.kind === "status" && f.status !== t.value) return false;
        if (t.kind === "text" && !f.name.toLowerCase().includes(t.value.toLowerCase()))
          return false;
      }
      // ما يُكتب الآن يصفّي مباشرةً قبل أن يصير وسمًا
      return !q || f.name.toLowerCase().includes(q);
    });
  }, [flows, tags, query]);

  const suggestions = useMemo(() => {
    const chosen = new Set(tags.map(tagKey));
    const q = query.trim().toLowerCase();
    const provs: Tag[] = available.provs
      .map((p) => ({ kind: "provider" as const, value: p }))
      .filter((t) => !chosen.has(tagKey(t)))
      .filter((t) => !q || tagLabel(t).toLowerCase().includes(q));
    const stats: Tag[] = available.stats
      .map((s) => ({ kind: "status" as const, value: s }))
      .filter((t) => !chosen.has(tagKey(t)))
      .filter((t) => !q || tagLabel(t).toLowerCase().includes(q));
    return [...provs, ...stats];
  }, [available, tags, query]);

  return (
    <main className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-6 py-10 min-h-0">
      <h1 className="text-[1.6rem] font-bold mb-5">ابحث في مساراتك</h1>

      {/* خانة الكتابة فوق — Enter يحوّل ما كُتب إلى وسم */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = query.trim();
          if (v) addTag({ kind: "text", value: v });
        }}
        className="composer"
      >
        <input
          className="composer-input"
          placeholder="اكتب اسم مسار… واضغط Enter ليصير وسمًا"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button
          className="composer-send"
          disabled={!query.trim()}
          title="أضف وسمًا"
          type="submit"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </form>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((t) => (
            <button
              key={tagKey(t)}
              onClick={() => removeTag(tagKey(t))}
              className="chip border-[var(--accent-bg)] text-[var(--accent)] bg-[var(--accent-soft)] gap-1.5"
              title="أزل الوسم"
            >
              {t.kind === "provider" && providerIcon(t.value, 14)}
              {tagLabel(t)}
              <span className="text-[0.7rem] opacity-70">✕</span>
            </button>
          ))}
          <button
            onClick={() => setTags([])}
            className="text-[0.72rem] text-[var(--text-soft)] hover:text-[var(--text)] px-1"
          >
            امسح الكل
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-[0.7rem] font-semibold text-[var(--text-soft)] mb-2">
            أضف وسمًا
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((t) => (
              <button
                key={tagKey(t)}
                onClick={() => addTag(t)}
                className="chip chip-neutral gap-1.5 hover:border-[var(--accent-bg)] hover:text-[var(--accent)]"
              >
                {t.kind === "provider" && providerIcon(t.value, 14)}
                {tagLabel(t)}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[0.75rem] text-[var(--text-soft)] mt-6 mb-2">
        {results.length} من {flows.length}
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {results.map((f) => (
          <Link
            key={f.id}
            href={`/flow/${f.id}`}
            className="card px-4 py-3 flex items-center gap-3 flex-wrap hover:border-[var(--accent-bg)] transition-colors"
          >
            <span className="font-semibold text-[0.88rem] min-w-0 flex-1 truncate">
              {f.name}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {f.providers.map((p) => (
                <span key={p} title={PROVIDER_LABELS[p]}>
                  {providerIcon(p, 16)}
                </span>
              ))}
            </span>
            <StatusChip status={f.status} />
          </Link>
        ))}

        {results.length === 0 && (
          <p className="text-[0.85rem] text-[var(--text-soft)] py-8 text-center">
            ما فيه مسار يطابق هذي الوسوم.
          </p>
        )}
      </div>
    </main>
  );
}
