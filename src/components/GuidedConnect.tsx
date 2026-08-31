"use client";

// الربط الموجَّه الموحّد — يُستخدم في اللوحة المنزلقة وبطاقة المحادثة ولوحة العقدة
// تيليجرام/سلاك/تيك توك: توكن المستخدم دائمًا (مع خطوات). OpenAI: مفتاحه أو اعتماد المنصة. Google: ضغطة عبر حساب المنصة.

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";

export const GUIDED_PROVIDERS = new Set<Provider>(["telegram", "slack", "tiktok", "openai"]);

const GUIDES: Partial<
  Record<
    Provider,
    { steps: string[]; steps_en: string[]; placeholder: string; platformOption?: boolean }
  >
> = {
  telegram: {
    steps: [
      "افتح @BotFather داخل تيليجرام وأرسل /newbot",
      "سمِّ البوت وانسخ الـToken",
      "افتح بوتك الجديد وأرسل له /start (مهم — حتى نلتقط معرف محادثتك تلقائيًا)",
      "الصق التوكن هنا",
    ],
    steps_en: [
      "Open @BotFather in Telegram and send /newbot",
      "Name your bot and copy the token",
      "Open your new bot and send it /start (so we auto-detect your chat id)",
      "Paste the token here",
    ],
    placeholder: "123456789:AAH...",
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

export default function GuidedConnect({
  provider,
  onConnected,
}: {
  provider: Provider;
  onConnected?: () => void;
}) {
  const { lang, t } = useLang();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const guide = GUIDES[provider];

  async function connect(withToken: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withToken ? { provider, token: token.trim() } : { provider }
        ),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "تعذر الربط");
      if (provider === "telegram" && d.bot) {
        setDone(
          d.bot.chat_id
            ? lang === "ar"
              ? `بوتك @${d.bot.username} متصل، والتقطنا معرف محادثتك تلقائيًا — الرسائل ستصلك مباشرة.`
              : `Bot @${d.bot.username} connected, chat id auto-detected — messages will reach you.`
            : lang === "ar"
              ? `بوتك @${d.bot.username} متصل. أرسل له /start ثم أعد الربط ليصلك الرد تلقائيًا.`
              : `Bot @${d.bot.username} connected. Send it /start then reconnect to auto-detect your chat.`
        );
      } else {
        setDone(lang === "ar" ? "تم الربط بنجاح." : "Connected.");
      }
      setToken("");
      onConnected?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <p className="text-xs text-emerald-300 leading-relaxed flex items-start gap-1.5">
        <span className="status-dot mt-1 shrink-0" style={{ background: "var(--ok)" }} />
        {done}
      </p>
    );

  // Google وأشباهه: ربط بحساب المنصة الموثّق بضغطة
  if (!guide)
    return (
      <div className="space-y-2">
        <button
          className="btn btn-primary text-xs py-1.5"
          disabled={busy}
          onClick={() => connect(false)}
        >
          {busy
            ? t("drawer.connecting")
            : lang === "ar"
              ? `ربط ${PROVIDER_LABELS[provider]} عبر حساب المنصة الموثّق`
              : `Connect ${PROVIDER_LABELS[provider]} via verified platform account`}
        </button>
        {err && <p className="text-xs text-amber-300">{err}</p>}
      </div>
    );

  return (
    <div className="space-y-2.5">
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
          onClick={() => connect(true)}
          disabled={busy || !token.trim()}
          className="btn btn-primary text-[0.72rem] py-1.5 flex-1"
        >
          {busy ? t("drawer.connecting") : t("drawer.connectMine")}
        </button>
        {guide.platformOption && (
          <button
            onClick={() => connect(false)}
            disabled={busy}
            className="btn btn-ghost text-[0.72rem] py-1.5"
          >
            {t("drawer.platformCred")}
          </button>
        )}
      </div>
      {err && <p className="text-xs text-amber-300 leading-relaxed">{err}</p>}
    </div>
  );
}
