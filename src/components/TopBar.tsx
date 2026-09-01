"use client";

// الشريط العلوي — الشعار يمينًا، تبويبا «إنشاء / سير العمل» في الوسط، وزر اللغة يسارًا.
// بقية الأدوات (الإنجازات، الإعدادات، السمة، الخروج) انتقلت إلى قائمة الحساب أسفل الشاشة
// حفاظًا على المظهر النظيف الفسيح.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { toggleLang, useLang } from "@/lib/i18n";
import Logo from "./Logo";

export default function TopBar() {
  const pathname = usePathname();
  const { lang, t } = useLang();

  const onCreate = pathname.startsWith("/chat");
  const onFlows = pathname.startsWith("/workflows") || pathname.startsWith("/flow");

  // .seg-tab يتكفّل بالتوسيط (inline-flex + place-items) ومنع اللف — انظر globals.css
  const tab = (active: boolean) => `seg-tab ${active ? "is-on" : ""}`;

  return (
    <header className="sticky top-0 z-40 h-[74px] flex items-center justify-between gap-3 px-5 sm:px-8 bg-[var(--panel)] backdrop-blur border-b border-[var(--line-soft)]">
      {/* الشعار */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0" title={t("brand")}>
        <span className="w-10 h-10 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] flex items-center justify-center shadow-sm">
          <Logo size={26} id="wLogoTop" />
        </span>
        <span className="hidden sm:block text-[1.15rem] font-bold">{t("brand")}</span>
      </Link>

      {/* التبويبات */}
      <nav className="seg">
        <Link href="/chat" className={tab(onCreate)}>
          {t("tab.create")}
        </Link>
        <Link href="/workflows" className={tab(onFlows)}>
          {t("tab.flows")}
        </Link>
      </nav>

      {/* اللغة — الأداة الوحيدة الباقية في الترويسة */}
      <button
        onClick={() => toggleLang()}
        className="shrink-0 w-10 h-9 rounded-full border border-[var(--line)] bg-[var(--panel)] text-[0.7rem] font-bold text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--accent-bg)] transition-colors"
        title={lang === "ar" ? "English" : "العربية"}
      >
        {lang === "ar" ? "EN" : "ع"}
      </button>
    </header>
  );
}
