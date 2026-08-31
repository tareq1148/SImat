"use client";

// لوحة منزلقة واحدة: الاتصالات + الإعدادات — بدل شاشتين كاملتين

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";
import { providerIcon } from "@/components/icons";

interface ConnRow {
  id: string;
  provider: Provider;
  label: string;
  status: string;
}

export default function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [speak, setSpeak] = useState(false);
  const [connected, setConnected] = useState<Set<Provider>>(new Set());
  const [busy, setBusy] = useState<Provider | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/connections");
    if (res.ok) {
      const d = await res.json();
      setConnected(new Set((d.connections as ConnRow[]).map((c) => c.provider)));
    }
  }, []);

  useEffect(() => {
    load();
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
    setThemeState(getTheme());
    try {
      setSpeak(localStorage.getItem("mv_speak") === "1");
    } catch {}
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load, onClose]);

  async function toggle(p: Provider) {
    setBusy(p);
    setErr(null);
    try {
      const revoke = connected.has(p);
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(revoke ? { provider: p, revoke: true } : { provider: p }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "تعذر الربط");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(null);
    }
  }

  function toggleSpeakPref() {
    setSpeak((v) => {
      try {
        localStorage.setItem("mv_speak", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const providers = Object.keys(PROVIDER_LABELS) as Provider[];

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 w-[400px] max-w-[92vw] bg-[var(--panel-solid)] border-l border-[var(--line)] shadow-2xl overflow-y-auto rise">
        <div className="sticky top-0 bg-[var(--panel-solid)] border-b border-[var(--line-soft)] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-[0.95rem]">الإعدادات</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--well)]"
            title="إغلاق"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-7">
          <section>
            <h3 className="text-[0.75rem] font-semibold text-[var(--text-soft)] mb-3">
              الاتصالات
            </h3>
            <div className="space-y-1.5">
              {providers.map((p) => {
                const isOn = connected.has(p);
                return (
                  <div
                    key={p}
                    className="flex items-center gap-3 rounded-xl border border-[var(--line-soft)] px-3 py-2.5"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[var(--well)] flex items-center justify-center shrink-0">
                      {providerIcon(p, 17)}
                    </span>
                    <span className="flex-1 text-[0.83rem] font-medium">
                      {PROVIDER_LABELS[p]}
                    </span>
                    <span
                      className="status-dot"
                      style={{ background: isOn ? "var(--ok)" : "var(--edge)" }}
                    />
                    <button
                      onClick={() => toggle(p)}
                      disabled={busy === p}
                      className={`text-[0.72rem] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        isOn
                          ? "border-[var(--line)] text-[var(--text-soft)] hover:text-[var(--bad)]"
                          : "border-transparent text-white"
                      }`}
                      style={isOn ? undefined : { background: "var(--accent-bg)" }}
                    >
                      {busy === p ? "..." : isOn ? "فصل" : "+ اربط"}
                    </button>
                  </div>
                );
              })}
            </div>
            {err && <p className="mt-2 text-xs text-amber-300">{err}</p>}
          </section>

          <section>
            <h3 className="text-[0.75rem] font-semibold text-[var(--text-soft)] mb-3">
              التفضيلات
            </h3>
            <div className="space-y-1.5">
              <button
                onClick={() => setThemeState(toggleTheme())}
                className="w-full flex items-center justify-between rounded-xl border border-[var(--line-soft)] px-3.5 py-3 text-[0.83rem] hover:bg-[var(--well)] transition-colors"
              >
                {theme === "dark" ? "الوضع الداكن" : "الوضع الفاتح"}
                <span className="theme-switch" />
              </button>
              <button
                onClick={toggleSpeakPref}
                className="w-full flex items-center justify-between rounded-xl border border-[var(--line-soft)] px-3.5 py-3 text-[0.83rem] hover:bg-[var(--well)] transition-colors"
              >
                نطق الردود صوتيًا
                <span
                  className="chip chip-neutral text-[0.65rem]"
                  style={speak ? { color: "var(--accent)", borderColor: "var(--accent-bg)" } : undefined}
                >
                  {speak ? "مفعّل" : "متوقف"}
                </span>
              </button>
            </div>
          </section>

          <section className="border-t border-[var(--line-soft)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p dir="ltr" className="text-[0.72rem] text-[var(--text-soft)] truncate text-right">
                {email ?? ""}
              </p>
              <button
                onClick={signOut}
                className="text-[0.78rem] font-semibold text-[var(--text-soft)] hover:text-[var(--bad)] shrink-0"
              >
                تسجيل الخروج
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
