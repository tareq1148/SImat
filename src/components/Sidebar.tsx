"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";

// الشريط الجانبي الأيمن — تقسيم الصفحة الرئيسي (سطح مكتب)، وشريط علوي قابل للتمرير (جوال)

type IconName =
  | "overview"
  | "chats"
  | "flows"
  | "progress"
  | "connections"
  | "settings"
  | "moon"
  | "sun"
  | "power";

function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    chats: <path d="M4 4h16v12H9l-5 4V4z" />,
    flows: (
      <>
        <circle cx="5" cy="6" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
        <circle cx="12" cy="18" r="2.2" />
        <path d="M6.5 7.8 10.6 16M17.5 7.8 13.4 16" />
      </>
    ),
    progress: <path d="M4 20v-6M10 20V6M16 20v-9M21 20H3" />,
    connections: (
      <>
        <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.3 1.3" />
        <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3" />
      </>
    ),
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

const MAIN_NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "نظرة عامة", icon: "overview" },
  { href: "/chat", label: "المحادثات", icon: "chats" },
  { href: "/flows", label: "مسارات العمل", icon: "flows" },
  { href: "/progress", label: "إنجازاتي", icon: "progress" },
];

const BOTTOM_NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/connections", label: "الاتصالات", icon: "connections" },
  { href: "/settings", label: "الإعدادات", icon: "settings" },
];

function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "md" ? "w-8 h-8 rounded-[10px] text-[0.95rem]" : "w-7 h-7 rounded-lg text-xs";
  return (
    <>
      <span
        className={`${box} font-bold flex items-center justify-center text-white shrink-0`}
        style={{ background: "var(--accent-bg)" }}
      >
        س
      </span>
      <span className={size === "md" ? "text-[1.05rem] font-bold" : "font-bold"}>سِمَاط</span>
    </>
  );
}

export default function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(getTheme());
    const onTheme = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener("simat-theme", onTheme);
    return () => window.removeEventListener("simat-theme", onTheme);
  }, []);

  function isActive(href: string) {
    if (href === "/flows") return pathname.startsWith("/flow"); // يشمل /flow/[id]
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const itemCls = (active: boolean) =>
    `relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[0.85rem] transition-colors ${
      active
        ? "bg-[var(--well)] text-[var(--text)] font-semibold"
        : "text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--well)]"
    }`;

  const indicator = (
    <span
      className="absolute inline-start-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
      style={{ background: "var(--accent-bg)", insetInlineStart: 0 }}
    />
  );

  return (
    <>
      {/* سطح المكتب: عمود ثابت على يمين الصفحة */}
      <aside className="hidden md:flex flex-col w-[232px] shrink-0 border-l border-[var(--line-soft)] bg-[var(--panel)] backdrop-blur sticky top-0 h-screen px-3.5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 mb-7">
          <Brand />
        </Link>

        <nav className="space-y-1">
          {MAIN_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={itemCls(isActive(item.href))}>
              {isActive(item.href) && indicator}
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-1">
          <div className="h-px bg-[var(--line-soft)] mb-2.5" />
          {BOTTOM_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={itemCls(isActive(item.href))}>
              {isActive(item.href) && indicator}
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => setTheme(toggleTheme())}
            className={`w-full ${itemCls(false)}`}
          >
            <Icon name={theme === "dark" ? "moon" : "sun"} />
            {theme === "dark" ? "الوضع الداكن" : "الوضع الفاتح"}
            <span className="theme-switch mr-auto" />
          </button>
          <button onClick={signOut} className={`w-full ${itemCls(false)}`}>
            <Icon name="power" />
            خروج
          </button>
          {email && (
            <p
              dir="ltr"
              className="px-3 pt-2 text-[0.65rem] text-[var(--text-soft)] opacity-70 truncate text-right"
            >
              {email}
            </p>
          )}
        </div>
      </aside>

      {/* الجوال: شريط علوي بالشعار وتنقّل أفقي */}
      <div className="md:hidden border-b border-[var(--line-soft)] bg-[var(--panel)] backdrop-blur sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Brand size="sm" />
          </Link>
          <div className="flex items-center gap-1 text-[var(--text-soft)]">
            <button
              onClick={() => setTheme(toggleTheme())}
              className="p-1.5 hover:text-[var(--text)]"
              title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
            >
              <Icon name={theme === "dark" ? "moon" : "sun"} size={16} />
            </button>
            <button onClick={signOut} className="p-1.5 hover:text-[var(--text)]" title="خروج">
              <Icon name="power" size={16} />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {[...MAIN_NAV, ...BOTTOM_NAV].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                isActive(item.href)
                  ? "bg-[var(--well)] text-[var(--text)] font-semibold"
                  : "text-[var(--text-soft)]"
              }`}
            >
              <Icon name={item.icon} size={13} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
