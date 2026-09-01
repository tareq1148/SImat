"use client";

// زر ربط Gmail — بجوار كرة الصوت في شريط الكتابة.
// غير متصل: زر زجاجي «اربط Gmail». متصل: شارة خضراء، وبنقرة تفصل الربط.

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

export default function GmailConnect() {
  const { t } = useLang();
  const [connected, setConnected] = useState<boolean | null>(null);
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

      let isConnected = false;
      try {
        const res = await fetch("/api/auth/google/status");
        if (res.ok) isConnected = Boolean((await res.json()).connected);
      } catch {
        // تعذّر الوصول للحالة = غير متصل
      }

      if (!alive) return;
      setConnected(isConnected || Boolean(ok));
      if (ok) setNote(t("gmail.done"));
      else if (err) setNote(err);
    })();

    return () => {
      alive = false;
    };
  }, [t]);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/auth/google/status", { method: "DELETE" });
      setConnected(false);
      setNote(t("gmail.removed"));
    } finally {
      setBusy(false);
    }
  }

  // قبل وصول الحالة لا نومض بزر خاطئ
  if (connected === null) return null;

  return (
    <>
      {connected ? (
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          title={t("gmail.disconnect")}
          className="gmail-chip is-on shrink-0"
        >
          <GmailIcon />
          <span className="hidden sm:inline">{t("gmail.connected")}</span>
          <span className="gmail-dot" aria-hidden />
        </button>
      ) : (
        <a href="/api/auth/google" title={t("gmail.connect")} className="gmail-chip shrink-0">
          <GmailIcon muted />
          <span className="hidden sm:inline">{t("gmail.connect")}</span>
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
    </>
  );
}
