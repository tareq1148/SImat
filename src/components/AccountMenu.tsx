"use client";

// قائمة الحساب — أفاتار ثابت في زاوية الشاشة السفلية.
// يحمل ما أُزيل من الترويسة والشريط الجانبي: الإنجازات، الإعدادات، السمة، والخروج.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { useLang } from "@/lib/i18n";
import SettingsDrawer from "./SettingsDrawer";

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    progress: <path d="M4 20v-6M10 20V6M16 20v-9M21 20H3" />,
    gear: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
      </>
    ),
    moon: <path d="M21 13.5A8.5 8.5 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
      </>
    ),
    power: <path d="M12 3v8M6.3 6.5a8 8 0 1 0 11.4 0" />,
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {paths[name]}
    </svg>
  );
}

export default function AccountMenu({ email }: { email: string | null }) {
  const router = useRouter();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(getTheme());
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener("simat-theme", on);
    return () => window.removeEventListener("simat-theme", on);
  }, []);

  // الإغلاق بالنقر خارج القائمة أو بـEscape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const item =
    "flex items-center gap-2.5 w-full rounded-lg px-3 h-9 text-[0.8rem] text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--well)] transition-colors";

  return (
    <>
      <div
        ref={wrapRef}
        className="fixed bottom-5 z-40"
        style={{ insetInlineStart: "1.25rem" }}
      >
        {open && (
          <div
            className="absolute bottom-12 w-56 p-1.5 rounded-2xl border border-[var(--line)] bg-[var(--panel-solid)] shadow-lg rise"
            style={{ insetInlineStart: 0 }}
            role="menu"
          >
            {email && (
              <p
                dir="ltr"
                className="px-3 pt-1.5 pb-2 text-[0.68rem] text-[var(--text-soft)] truncate text-start"
              >
                {email}
              </p>
            )}
            <Link href="/progress" className={item} onClick={() => setOpen(false)}>
              <Icon name="progress" />
              <span>{t("nav.progress")}</span>
            </Link>
            <button
              className={item}
              onClick={() => {
                setDrawer(true);
                setOpen(false);
              }}
            >
              <Icon name="gear" />
              <span>{t("nav.settings")}</span>
            </button>
            <button className={item} onClick={() => setTheme(toggleTheme())}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
              <span>{theme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")}</span>
            </button>
            <div className="my-1 h-px bg-[var(--line-soft)]" />
            <button className={item} onClick={signOut}>
              <Icon name="power" />
              <span>{t("nav.signout")}</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={email ?? t("nav.account")}
          className={`w-9 h-9 rounded-full text-white text-[0.8rem] font-bold flex items-center justify-center shadow-sm transition-transform hover:scale-105 ${
            open ? "ring-2 ring-[var(--accent-bg)]" : ""
          }`}
          style={{ background: "var(--grad-accent)" }}
        >
          {(email ?? "?").charAt(0).toUpperCase()}
        </button>
      </div>

      {drawer && <SettingsDrawer onClose={() => setDrawer(false)} />}
    </>
  );
}
