"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

// الشريط الجانبي الأيمن — تقسيم الصفحة الرئيسي (سطح مكتب)، وشريط علوي قابل للتمرير (جوال)

type IconName =
  | "overview"
  | "chats"
  | "flows"
  | "progress"
  | "connections"
  | "settings"
  | "moon"
  | "power";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
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
        <circle cx="9" cy="7" r="2" fill="#0c1120" />
        <circle cx="15" cy="12" r="2" fill="#0c1120" />
        <circle cx="7" cy="17" r="2" fill="#0c1120" />
      </>
    ),
    moon: <path d="M21 13.5A8.5 8.5 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z" />,
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

export default function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

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
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
      active
        ? "bg-cyan-400/10 text-cyan-200 font-semibold"
        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
    }`;

  return (
    <>
      {/* سطح المكتب: عمود ثابت على يمين الصفحة */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-l border-[#1c2740] bg-[#0c1120]/70 backdrop-blur sticky top-0 h-screen px-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 mb-8">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-[#06121f] text-base font-bold flex items-center justify-center">
            س
          </span>
          <span className="text-lg font-bold bg-gradient-to-l from-cyan-300 to-violet-300 bg-clip-text text-transparent">
            سِمَاط
          </span>
        </Link>

        <nav className="space-y-1.5">
          {MAIN_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={itemCls(isActive(item.href))}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-1.5">
          <div className="h-px bg-[#1c2740] mb-3" />
          {BOTTOM_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={itemCls(isActive(item.href))}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
          <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-slate-400">
            <Icon name="moon" />
            وضع داكن
            <span className="chip text-[0.6rem] px-2 py-0 mr-auto border-cyan-400/30 text-cyan-300 bg-cyan-400/5">
              مفعّل
            </span>
          </div>
          <button onClick={signOut} className={`w-full ${itemCls(false)} hover:!text-red-300`}>
            <Icon name="power" />
            خروج
          </button>
          {email && (
            <p dir="ltr" className="px-3.5 pt-2 text-[0.65rem] text-slate-600 truncate text-right">
              {email}
            </p>
          )}
        </div>
      </aside>

      {/* الجوال: شريط علوي بالشعار وتنقّل أفقي */}
      <div className="md:hidden border-b border-[#1c2740] bg-[#0c1120]/70 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 text-[#06121f] text-xs font-bold flex items-center justify-center">
              س
            </span>
            <span className="bg-gradient-to-l from-cyan-300 to-violet-300 bg-clip-text text-transparent">
              سِمَاط
            </span>
          </Link>
          <button onClick={signOut} className="text-slate-400 hover:text-red-300 p-1.5" title="خروج">
            <Icon name="power" size={17} />
          </button>
        </div>
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {[...MAIN_NAV, ...BOTTOM_NAV].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                isActive(item.href)
                  ? "bg-cyan-400/10 text-cyan-200 font-semibold"
                  : "text-slate-400"
              }`}
            >
              <Icon name={item.icon} size={14} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
