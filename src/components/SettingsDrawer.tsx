"use client";

// لوحة منزلقة واحدة: الاتصالات + الإعدادات — بدل شاشتين كاملتين

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { toggleLang, useLang } from "@/lib/i18n";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";
import { providerIcon } from "@/components/icons";
import GuidedConnect, { GUIDED_PROVIDERS } from "@/components/GuidedConnect";
import GmailConnect from "@/components/GmailConnect";

interface ConnRow {
  id: string;
  provider: Provider;
  label: string;
  status: string;
}

// الربط الموجَّه انتقل إلى مكوّن GuidedConnect المشترك

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
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(null);
    }
  }

  function onConnectClick(p: Provider) {
    if (connected.has(p)) return connect(p, { revoke: true });
    if (GUIDED_PROVIDERS.has(p)) {
      setErr(null);
      setGuideFor(guideFor === p ? null : p);
      return;
    }
    connect(p); // Google: حساب المنصة الموثّق عبر OAuth — ضغطة واحدة
  }

  const [voiceInfo, setVoiceInfo] = useState<{ provider: string | null; voice?: { name?: string } | null } | null>(null);
  useEffect(() => {
    fetch("/api/voice/status")
      .then((r) => r.json())
      .then((d) => setVoiceInfo({ provider: d.provider ?? null, voice: d.voice ?? null }))
      .catch(() => setVoiceInfo({ provider: null }));
  }, []);

  const PROVIDER_LABEL: Record<string, string> = {
    elevenlabs: "ElevenLabs",
    voicestudio: "VoiceStudio",
    browser: lang === "ar" ? "صوت المتصفح" : "Browser voice",
  };

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

  // OpenAI مستثنى: المنصة توفّره لكل المسارات تلقائيًا، فلا يُطلب من المستخدم ربطه
  const providers = (Object.keys(PROVIDER_LABELS) as Provider[]).filter(
    (p) => p !== "openai"
  );

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 w-[400px] max-w-[92vw] bg-[var(--panel-solid)] border-e border-[var(--line)] shadow-2xl overflow-y-auto rise" style={{ insetInlineStart: 0 }}>
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

                    {open && !isOn && (
                      <div className="border-t border-[var(--line-soft)] px-3.5 py-3 rise">
                        <GuidedConnect
                          provider={p}
                          onConnected={() => {
                            load();
                          }}
                        />
                      </div>
                    )}

                    {/* Gmail: ربط حسابك الشخصي عبر OAuth — مستقل عن اعتماد المنصة
                        (هذا لا يُستخدم في بناء المسار على المحرك) */}
                    {p === "gmail" && (
                      <div className="border-t border-[var(--line-soft)] px-3.5 py-3">
                        <p className="text-[0.68rem] text-[var(--text-soft)] mb-2">
                          {t("drawer.gmailOwn")}
                        </p>
                        <GmailConnect />
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
              {voiceInfo && (
                <p className="text-[0.7rem] text-[var(--text-soft)] px-1">
                  {lang === "ar" ? "محرك الصوت: " : "Voice engine: "}
                  <span className="text-[var(--text)]">
                    {PROVIDER_LABEL[voiceInfo.provider ?? "browser"] ??
                      PROVIDER_LABEL.browser}
                  </span>
                  {voiceInfo.voice?.name ? ` — ${voiceInfo.voice.name}` : ""}
                </p>
              )}
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
