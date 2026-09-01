"use client";

// طلب الارتباطات بعد البناء — يعرض ما ينقص المسار وحده لا كل التكاملات.
// قائمة «الناقص» تأتي من محرّك البناء نفسه، فلا يُطلب من المستخدم ربطُ ما لا يلزمه.

import { useState } from "react";
import GuidedConnect from "./GuidedConnect";
import { providerIcon } from "./icons";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";

export default function ConnectionsPrompt({
  missing,
  onConnected,
}: {
  missing: Provider[];
  onConnected: () => void;
}) {
  // يُفتح أول مزوّد تلقائيًا: الحالة الغالبة ارتباط واحد ناقص، فلا معنى لضغطة زائدة
  const [open, setOpen] = useState<Provider | null>(missing[0] ?? null);

  if (missing.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mb-3 space-y-2.5">
      <p className="text-[0.82rem] text-[var(--text-soft)] leading-relaxed">
        {missing.length === 1
          ? "المسار جاهز، وينقصه ربط واحد:"
          : `المسار جاهز، وتنقصه ${missing.length} ارتباطات:`}
      </p>

      {missing.map((p) => {
        const expanded = open === p;
        return (
          <div
            key={p}
            className={`rounded-2xl border p-5 transition-colors ${
              expanded
                ? "border-[var(--accent-bg)] bg-[var(--accent-soft)]"
                : "border-[var(--line)] bg-[var(--well)]"
            }`}
          >
            <button
              onClick={() => setOpen(expanded ? null : p)}
              className="w-full flex items-center gap-4 text-start"
            >
              <span className="w-14 h-14 shrink-0 rounded-2xl bg-[var(--panel-solid)] border border-[var(--line)] flex items-center justify-center">
                {providerIcon(p, 30)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-bold">
                  {PROVIDER_LABELS[p]}
                </span>
                <span className="block text-[0.74rem] text-[var(--text-soft)]">
                  غير مرتبط
                </span>
              </span>
            </button>

            {expanded && (
              <div className="mt-4 pt-4 border-t border-[var(--line)]">
                <GuidedConnect provider={p} onConnected={onConnected} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
