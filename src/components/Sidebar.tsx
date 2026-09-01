"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { toggleLang, useLang } from "@/lib/i18n";
import SettingsDrawer from "./SettingsDrawer";
import Logo from "./Logo";

// شريط أيقونات نحيف — 3 شاشات فقط، والإعدادات لوحة منزلقة

type IconName = "chats" | "progress" | "settings" | "moon" | "sun" | "power";

function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    chats: <path d="M4 4h16v12H9l-5 4V4z" />,
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
      className="shrink-0"
    >
      {paths[name]}
    </svg>
  );
}

const NAV: { href: string; key: string; icon: IconName }[] = [
  { href: "/chat", key: "nav.chat", icon: "chats" },
  { href: "/progress", key: "nav.progress", icon: "progress" },
];

export default function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useLang();
  const [theme, setTheme] = useState<Theme>("dark");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setTheme(getTheme());
    const onTheme = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener("simat-theme", onTheme);
    return () => window.removeEventListener("simat-theme", onTheme);
  }, []);

  function isActive(href: string) {
    if (href === "/chat")
      return pathname.startsWith("/chat") || pathname.startsWith("/flow") || pathname.startsWith("/dashboard");
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const railBtn = (active: boolean) =>
    `relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
      active
        ? "text-[var(--accent)] bg-[var(--accent-soft)]"
        : "text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--well)]"
    }`;

  return (
    <>
      {/* سطح المكتب: شريط أيقونات نحيف على اليمين */}
      <aside className="hidden md:flex flex-col items-center w-16 shrink-0 border-e border-[var(--line-soft)] bg-[var(--panel)] backdrop-blur sticky top-0 h-screen py-5 gap-2">
        <Link
          href="/chat"
          title={t("brand")}
          className="w-10 h-10 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] flex items-center justify-center mb-4 shadow-sm hover:scale-105 transition-transform"
        >
          <Logo size={28} id="wLogoRail" />
        </Link>

        {NAV.map((item) => (
          <Link key={item.href} href={item.href} title={t(item.key)} className={railBtn(isActive(item.href))}>
            {isActive(item.href) && (
              <span
                className="absolute w-[3px] h-5 rounded-full"
                style={{ background: "var(--accent-bg)", insetInlineStart: -10 }}
              />
            )}
            <Icon name={item.icon} />
          </Link>
        ))}

        <div className="mt-auto flex flex-col items-center gap-2">
          <button
            onClick={() => toggleLang()}
            title={lang === "ar" ? "English" : "العربية"}
            className={`${railBtn(false)} text-[0.72rem] font-bold`}
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
          <button onClick={() => setDrawer(true)} title={t("nav.settings")} className={railBtn(false)}>
            <Icon name="settings" />
          </button>
          <button
            onClick={() => setTheme(toggleTheme())}
            title={theme === "dark" ? t("nav.theme.light") : t("nav.theme.dark")}
            className={railBtn(false)}
          >
            <Icon name={theme === "dark" ? "moon" : "sun"} />
          </button>
          <button onClick={signOut} title={`${t("nav.signout")}${email ? ` — ${email}` : ""}`} className={railBtn(false)}>
            <Icon name="power" />
          </button>
        </div>
      </aside>

      {/* الجوال: شريط علوي مضغوط */}
      <div className="md:hidden border-b border-[var(--line-soft)] bg-[var(--panel)] backdrop-blur sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-13 py-2">
          <Link href="/chat" className="flex items-center gap-2 font-bold">
            <span className="w-8 h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] flex items-center justify-center">
              <Logo size={22} id="wLogoMob" />
            </span>
            {t("brand")}
          </Link>
          <div className="flex items-center gap-1 text-[var(--text-soft)]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={t(item.key)}
                className={`p-2 rounded-lg ${isActive(item.href) ? "text-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}
              >
                <Icon name={item.icon} size={17} />
              </Link>
            ))}
            <button
              onClick={() => toggleLang()}
              className="p-2 text-[0.7rem] font-bold"
              title={lang === "ar" ? "English" : "العربية"}
            >
              {lang === "ar" ? "EN" : "ع"}
            </button>
            <button onClick={() => setDrawer(true)} title={t("drawer.title")} className="p-2">
              <Icon name="settings" size={17} />
            </button>
            <button onClick={() => setTheme(toggleTheme())} className="p-2" title="theme">
              <Icon name={theme === "dark" ? "moon" : "sun"} size={17} />
            </button>
            <button onClick={signOut} className="p-2" title={t("nav.signout")}>
              <Icon name="power" size={17} />
            </button>
          </div>
        </div>
      </div>

      {drawer && <SettingsDrawer onClose={() => setDrawer(false)} />}
    </>
  );
}
