"use client";

// لوحة منزلقة واحدة: الاتصالات + الإعدادات — بدل شاشتين كاملتين

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { toggleLang, useLang } from "@/lib/i18n";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";
import { providerIcon } from "@/components/icons";

interface ConnRow {
  id: string;
  provider: Provider;
  label: string;
  status: string;
}

// دليل ربط موجَّه لكل تكامل يقبل توكن المستخدم — خطوات قصيرة ثم لصق
const GUIDES: Partial<
  Record<
    Provider,
    { steps: string[]; steps_en: string[]; placeholder: string; platformOption?: boolean }
  >
> = {
  telegram: {
    steps: [
      "افتح @BotFather داخل تيليجرام",
      "أرسل /newbot وسمِّ البوت",
      "انسخ الـToken والصقه هنا",
    ],
    steps_en: [
      "Open @BotFather inside Telegram",
      "Send /newbot and name your bot",
      "Copy the token and paste it here",
    ],
    placeholder: "123456789:AAH...",
    platformOption: true,
  },
  openai: {
    steps: ["افتح platform.openai.com/api-keys", "أنشئ Secret key جديدًا", "الصقه هنا"],
    steps_en: ["Open platform.openai.com/api-keys", "Create a new secret key", "Paste it here"],
    placeholder: "sk-...",
    platformOption: true,
  },
  slack: {
    steps: [
      "api.slack.com/apps ← Create New App",
      "OAuth & Permissions ← أضف chat:write ثم Install",
      "انسخ Bot User OAuth Token",
    ],
    steps_en: [
      "api.slack.com/apps → Create New App",
      "OAuth & Permissions → add chat:write, then Install",
      "Copy the Bot User OAuth Token",
    ],
    placeholder: "xoxb-...",
  },
  tiktok: {
    steps: ["افتح developers.tiktok.com", "فعّل صلاحيات نشر الفيديو لتطبيقك", "انسخ Access Token"],
    steps_en: ["Open developers.tiktok.com", "Enable video publish scopes", "Copy the access token"],
    placeholder: "act....",
  },
};

export default function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { lang, t } = useLang();
  const [email, setEmail] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [speak, setSpeak] = useState(false);
  const [connected, setConnected] = useState<Set<Provider>>(new Set());
  const [busy, setBusy] = useState<Provider | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [guideFor, setGuideFor] = useState<Provider | null>(null);
  const [token, setToken] = useState("");

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

  async function connect(p: Provider, opts?: { token?: string; revoke?: boolean }) {
    setBusy(p);
    setErr(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p, ...opts }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "تعذر الربط");
      setGuideFor(null);
      setToken("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(null);
    }
  }

  function onConnectClick(p: Provider) {
    if (connected.has(p)) return connect(p, { revoke: true });
    if (GUIDES[p]) {
      setErr(null);
      setToken("");
      setGuideFor(guideFor === p ? null : p);
      return;
    }
    connect(p); // Google: حساب المنصة الموثّق عبر OAuth — ضغطة واحدة
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
      <aside className="absolute inset-y-0 inline-end-0 w-[400px] max-w-[92vw] bg-[var(--panel-solid)] border-s border-[var(--line)] shadow-2xl overflow-y-auto rise" style={{ insetInlineEnd: 0 }}>
        <div className="sticky top-0 bg-[var(--panel-solid)] border-b border-[var(--line-soft)] px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-[0.95rem]">{t("drawer.title")}</h2>
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
              {t("drawer.connections")}
            </h3>
            <div className="space-y-1.5">
              {providers.map((p) => {
                const isOn = connected.has(p);
                const guide = GUIDES[p];
                const open = guideFor === p;
                return (
                  <div key={p} className="rounded-xl border border-[var(--line-soft)]">
                    <div className="flex items-center gap-3 px-3 py-2.5">
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
                        onClick={() => onConnectClick(p)}
                        disabled={busy === p}
                        className={`text-[0.72rem] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                          isOn
                            ? "border-[var(--line)] text-[var(--text-soft)] hover:text-[var(--bad)]"
                            : "border-transparent text-white"
                        }`}
                        style={isOn ? undefined : { background: "var(--accent-bg)" }}
                      >
                        {busy === p ? "..." : isOn ? t("drawer.disconnect") : t("drawer.connect")}
                      </button>
                    </div>

                    {open && guide && !isOn && (
                      <div className="border-t border-[var(--line-soft)] px-3.5 py-3 space-y-2.5 rise">
                        <ol className="space-y-1.5">
                          {(lang === "en" ? guide.steps_en : guide.steps).map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-[0.75rem] text-[var(--text-soft)]">
                              <span
                                className="shrink-0 w-4.5 h-4.5 rounded-full text-[0.62rem] font-bold text-white flex items-center justify-center mt-px"
                                style={{ background: "var(--accent-bg)" }}
                              >
                                {i + 1}
                              </span>
                              <span dir="auto">{s}</span>
                            </li>
                          ))}
                        </ol>
                        <input
                          className="input text-xs"
                          dir="ltr"
                          type="password"
                          placeholder={guide.placeholder}
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => connect(p, { token })}
                            disabled={busy === p || !token.trim()}
                            className="btn btn-primary text-[0.72rem] py-1.5 flex-1"
                          >
                            {busy === p ? t("drawer.connecting") : t("drawer.connectMine")}
                          </button>
                          {guide.platformOption && (
                            <button
                              onClick={() => connect(p)}
                              disabled={busy === p}
                              className="btn btn-ghost text-[0.72rem] py-1.5"
                            >
                              {t("drawer.platformCred")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2.5 text-[0.68rem] text-[var(--text-soft)] opacity-80">
              {t("drawer.googleNote")}
            </p>
            {err && <p className="mt-2 text-xs text-amber-300">{err}</p>}
          </section>

          <section>
            <h3 className="text-[0.75rem] font-semibold text-[var(--text-soft)] mb-3">
              {t("drawer.prefs")}
            </h3>
            <div className="space-y-1.5">
              <button
                onClick={() => toggleLang()}
                className="w-full flex items-center justify-between rounded-xl border border-[var(--line-soft)] px-3.5 py-3 text-[0.83rem] hover:bg-[var(--well)] transition-colors"
              >
                {t("drawer.lang")}
                <span className="chip chip-neutral text-[0.65rem]">
                  {lang === "ar" ? "العربية ← English" : "English ← العربية"}
                </span>
              </button>
              <button
                onClick={() => setThemeState(toggleTheme())}
                className="w-full flex items-center justify-between rounded-xl border border-[var(--line-soft)] px-3.5 py-3 text-[0.83rem] hover:bg-[var(--well)] transition-colors"
              >
                {theme === "dark" ? t("nav.theme.dark") : t("nav.theme.light")}
                <span className="theme-switch" />
              </button>
              <button
                onClick={toggleSpeakPref}
                className="w-full flex items-center justify-between rounded-xl border border-[var(--line-soft)] px-3.5 py-3 text-[0.83rem] hover:bg-[var(--well)] transition-colors"
              >
                {t("drawer.speak")}
                <span
                  className="chip chip-neutral text-[0.65rem]"
                  style={speak ? { color: "var(--accent)", borderColor: "var(--accent-bg)" } : undefined}
                >
                  {speak ? t("drawer.on") : t("drawer.off")}
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
                {t("drawer.signout")}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
