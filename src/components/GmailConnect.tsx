"use client";

// ربط Gmail عبر OAuth — يظهر داخل «طلب الربط» (GuidedConnect).
// ثلاث حالات: غير متصل / متصل (بنقرة يُفصل) / منتهي الصلاحية (يحتاج إعادة ربط).

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

function GmailIcon({ muted }: { muted?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        d="M2.4 6.4v11.2c0 .66.54 1.2 1.2 1.2h2.8V10.3l5.6 4.2 5.6-4.2v8.5h2.8c.66 0 1.2-.54 1.2-1.2V6.4c0-1.32-1.5-2.07-2.55-1.28L12 9.9 4.95 5.12C3.9 4.33 2.4 5.08 2.4 6.4z"
        fill={muted ? "currentColor" : "#EA4335"}
        opacity={muted ? 0.75 : 1}
      />
    </svg>
  );
}

type State = "loading" | "off" | "on" | "reauth";

export default function GmailConnect() {
  const { t } = useLang();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // تدفّق واحد غير متزامن: نتيجة العودة من جوجل (إن وُجدت) ثم حالة الربط.
  // كل ضبط للحالة يقع بعد await — فلا تتالي تصييرات من جسم التأثير.
  useEffect(() => {
    let alive = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const ok = params.get("gmail_connected");
      const err = params.get("gmail_error");

      if (ok || err) {
        params.delete("gmail_connected");
        params.delete("gmail_error");
        const rest = params.toString();
        window.history.replaceState(
          {},
          "",
          window.location.pathname + (rest ? `?${rest}` : "")
        );
      }

      let next: State = "off";
      let statusErr: string | null = null;
      try {
        const res = await fetch("/api/auth/google/status");
        if (res.ok) {
          const d = await res.json();
          if (d.needs_reauth) {
            next = "reauth";
            statusErr = d.error ?? null;
          } else if (d.connected) next = "on";
        }
      } catch {
        // تعذّر الوصول للحالة = غير متصل
      }

      if (!alive) return;
      setState(ok && next === "off" ? "on" : next);
      if (ok) setNote(t("gmail.done"));
      else if (err) setNote(err);
      else if (next === "reauth") setNote(statusErr ?? t("gmail.expired"));
    })();

    return () => {
      alive = false;
    };
  }, [t]);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/auth/google/status", { method: "DELETE" });
      setState("off");
      setNote(t("gmail.removed"));
    } finally {
      setBusy(false);
    }
  }

  // قبل وصول الحالة لا نومض بزر خاطئ
  if (state === "loading") return null;

  return (
    <div className="space-y-2">
      {state === "on" ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="gmail-chip is-on">
            <GmailIcon />
            {t("gmail.connected")}
            <span className="gmail-dot" aria-hidden />
          </span>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="btn btn-ghost text-[0.72rem] py-1.5"
          >
            {t("gmail.disconnect")}
          </button>
        </div>
      ) : state === "reauth" ? (
        <div className="space-y-1.5">
          <p className="text-[0.72rem] text-amber-300 leading-relaxed">
            {t("gmail.expired")}
          </p>
          <a href="/api/auth/google?service=gmail" className="gmail-chip is-stale">
            <GmailIcon muted />
            {t("gmail.reconnect")}
            <span className="gmail-dot is-stale" aria-hidden />
          </a>
        </div>
      ) : (
        <a href="/api/auth/google?service=gmail" className="gmail-chip">
          <GmailIcon muted />
          {t("gmail.connect")}
        </a>
      )}

      {note && (
        <span
          role="status"
          className="fixed bottom-24 inset-x-0 mx-auto w-max max-w-[90vw] z-50 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] px-4 py-2 text-[0.78rem] text-[var(--text-soft)] shadow-lg rise cursor-pointer"
          onClick={() => setNote(null)}
        >
          {note}
        </span>
      )}
    </div>
  );
}
