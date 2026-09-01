"use client";

// الشريط العلوي — الشعار يمينًا، تبويبا «إنشاء / سير العمل» في الوسط، والأدوات يسارًا

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { toggleLang, useLang } from "@/lib/i18n";
import SettingsDrawer from "./SettingsDrawer";
import Logo from "./Logo";

function Icon({ name, size = 17 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    progress: <path d="M4 20v-6M10 20V6M16 20v-9M21 20H3" />,
    settings: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="var(--panel-solid)" />
        <circle cx="15" cy="12" r="2" fill="var(--panel-solid)" />
        <circle cx="7" cy="17" r="2" fill="var(--panel-solid)" />
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
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function TopBar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useLang();
  const [theme, setTheme] = useState<Theme>("dark");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setTheme(getTheme());
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener("simat-theme", on);
    return () => window.removeEventListener("simat-theme", on);
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const onCreate = pathname.startsWith("/chat");
  const onFlows = pathname.startsWith("/workflows") || pathname.startsWith("/flow");

  // inline-flex + توسيط: بدونها يُصيَّر الرابط كتلةً فيلتصق النص بأعلى الصندوق ويمينه
  const tab = (active: boolean) =>
    `inline-flex items-center justify-center whitespace-nowrap min-w-[112px] h-11 px-6 rounded-[14px] text-[0.85rem] font-semibold transition-all ${
      active
        ? "bg-[var(--panel-solid)] text-[var(--text)] shadow-sm"
        : "text-[var(--text-soft)] hover:text-[var(--text)]"
    }`;

  const toolBtn =
    "w-9 h-9 rounded-full border border-[var(--line)] bg-[var(--panel)] backdrop-blur flex items-center justify-center text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--accent-bg)] transition-colors";

  return (
    <>
      <header className="sticky top-0 z-40 h-[74px] flex items-center justify-between gap-3 px-5 sm:px-8 bg-[var(--panel)] backdrop-blur border-b border-[var(--line-soft)]">
        {/* الشعار */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0" title={t("brand")}>
          <span className="w-10 h-10 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] flex items-center justify-center shadow-sm">
            <Logo size={26} id="wLogoTop" />
          </span>
          <span className="hidden sm:block text-[1.15rem] font-bold">{t("brand")}</span>
        </Link>

        {/* التبويبات */}
        <nav className="flex items-center gap-1 p-1.5 rounded-[18px] border border-[var(--line-soft)] bg-[var(--well)]">
          <Link href="/chat" className={tab(onCreate)}>
            {t("tab.create")}
          </Link>
          <Link href="/workflows" className={tab(onFlows)}>
            {t("tab.flows")}
          </Link>
        </nav>

        {/* الأدوات */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => toggleLang()}
            className="w-10 h-9 rounded-full border border-[var(--line)] bg-[var(--panel)] text-[0.7rem] font-bold text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--accent-bg)] transition-colors"
            title={lang === "ar" ? "English" : "العربية"}
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
          {/* على الشاشات الكبيرة يتكفّل الشريط الجانبي بهذين */}
          <Link href="/progress" className={`${toolBtn} md:hidden`} title={t("nav.progress")}>
            <Icon name="progress" />
          </Link>
          <button
            onClick={() => setDrawer(true)}
            className={`${toolBtn} md:hidden`}
            title={t("nav.settings")}
          >
            <Icon name="settings" />
          </button>
          <button
            onClick={() => setTheme(toggleTheme())}
            className={toolBtn}
            title={theme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")}
          >
            <Icon name={theme === "dark" ? "moon" : "sun"} />
          </button>
          <button
            onClick={signOut}
            className={toolBtn}
            title={`${t("nav.signout")}${email ? ` — ${email}` : ""}`}
          >
            <Icon name="power" />
          </button>
        </div>
      </header>

      {drawer && <SettingsDrawer onClose={() => setDrawer(false)} />}
    </>
  );
}
