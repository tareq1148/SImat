"use client";

// شاشة البحث: خانة كتابة فوق وبحث نصّي مباشر في أسماء المسارات.
// الحالة تُختصر إلى نقطة ملوّنة: أحمر ينقصه ربط، أخضر يعمل، رمادي متوقّف.
// النصّ الكامل للحالة يبقى في تلميح النقطة، فلا تضيع المعلومة.

import { useMemo, useState } from "react";
import Link from "next/link";
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

function dotColor(status: FlowStatus): string {
  if (status === "NeedsConnections") return "var(--bad)";
  if (status === "Active") return "var(--ok)";
  return "var(--edge)";
}

export default function SearchView({ flows }: { flows: SearchFlow[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flows;
    // يطابق الاسم أو اسم خدمة يستعملها المسار — «جيميل» تجد مسارات البريد
    return flows.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.providers.some((p) => PROVIDER_LABELS[p].toLowerCase().includes(q))
    );
  }, [flows, query]);

  return (
    <main className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-6 py-10 min-h-0">
      <h1 className="text-[1.6rem] font-bold mb-5">ابحث في مساراتك</h1>

      <div className="composer">
        <span className="shrink-0 ps-1 text-[var(--text-soft)]" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M15.8 15.8 20 20" />
          </svg>
        </span>
        <input
          className="composer-input"
          placeholder="اكتب اسم المسار…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            title="امسح"
            className="shrink-0 pe-1 text-[var(--text-soft)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        )}
      </div>

      <p className="text-[0.75rem] text-[var(--text-soft)] mt-5 mb-2">
        {results.length} من {flows.length}
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {results.map((f) => (
          <Link
            key={f.id}
            href={`/flow/${f.id}`}
            className="card px-4 py-3 flex items-center gap-3 hover:border-[var(--accent-bg)] transition-colors"
          >
            <span
              className="status-dot shrink-0"
              style={{ background: dotColor(f.status) }}
              title={STATUS_LABELS[f.status]}
            />
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
          </Link>
        ))}

        {results.length === 0 && (
          <p className="text-[0.85rem] text-[var(--text-soft)] py-8 text-center">
            ما فيه مسار بهذا الاسم.
          </p>
        )}
      </div>
    </main>
  );
}
