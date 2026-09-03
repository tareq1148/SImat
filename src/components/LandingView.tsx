"use client";

// نقطة البداية — صفحة كاملة بلا إطار: الكلام في جهة القراءة الأولى والشبكة العصبية تملأ الجهة المقابلة

import Link from "next/link";
import { useEffect, useState } from "react";
import { toggleLang, useLang } from "@/lib/i18n";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import Logo from "./Logo";
import NeuralField from "./NeuralField";

export default function LandingView() {
  const { lang, t } = useLang();
  const ar = lang === "ar";
  // «ابدأ» تقود إلى المحادثة دائمًا. كانت تفرز الزائر إلى صفحة دخول،
  // وقد صار التخطيط يفتح له جلسة ضيف — فالفرز هنا يردّه قبل أن يبلغها.
  const startHref = "/chat";
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(getTheme());
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener("simat-theme", on);
    return () => window.removeEventListener("simat-theme", on);
  }, []);

  return (
    <main className="flex-1 relative overflow-hidden">
      {/* ترويسة علوية: الشعار في جهة القراءة الأولى والأدوات مقابله */}
      <header className="absolute top-0 inset-x-0 z-20 h-20 flex items-center justify-between px-7 sm:px-12 md:px-16">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-85 transition-opacity"
        >
          <Logo size={40} id="wLogoLanding" />
          <span className="text-[1.4rem] font-bold tracking-tight">{t("brand")}</span>
        </Link>

        <div className="flex items-center gap-2">
        <button
          onClick={() => toggleLang()}
          className="w-11 h-9 rounded-full border border-[var(--line)] bg-[var(--panel)] backdrop-blur text-[0.72rem] font-bold text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--accent-bg)] transition-colors"
          title={ar ? "English" : "العربية"}
        >
          {ar ? "EN" : "ع"}
        </button>
        <button
          onClick={() => setTheme(toggleTheme())}
          className="w-9 h-9 rounded-full border border-[var(--line)] bg-[var(--panel)] backdrop-blur flex items-center justify-center text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--accent-bg)] transition-colors"
          title={
            theme === "dark"
              ? ar
                ? "الوضع الفاتح"
                : "Light mode"
              : ar
                ? "الوضع الداكن"
                : "Dark mode"
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {theme === "dark" ? (
              <path d="M21 13.5A8.5 8.5 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
              </>
            )}
          </svg>
          </button>
        </div>
      </header>

      {/* الشبكة العصبية تملأ الجهة المقابلة للنص وتمتد خلف الصفحة */}
      <div
        className="neural-mask absolute inset-y-0 hidden md:block w-[58%] pointer-events-auto"
        style={{ insetInlineEnd: 0 }}
      >
        <NeuralField height="100%" />
      </div>

      <div className="relative z-10 min-h-[calc(100vh-2rem)] flex items-center px-7 sm:px-12 md:px-16">
        <div className="w-full md:w-[46%] text-center md:text-start py-14">
          <h1 className="text-[2.2rem] sm:text-[3rem] font-bold leading-[1.42] mb-5 rise-1 text-[var(--text)]">
            {ar ? "حوّل فكرتك إلى سير عمل ذكي" : "Turn your idea into a smart workflow"}
          </h1>

          <p className="text-[1.1rem] sm:text-[1.3rem] font-semibold text-[var(--text-soft)] mb-11 tracking-tight rise-2">
            <span className="tag-word">{t("home.w1")}.</span>{" "}
            <span className="tag-word">{t("home.w2")}.</span>{" "}
            <span className="tag-word text-[var(--accent)]">{t("home.w3")}.</span>
          </p>

          <div className="flex justify-center md:justify-start rise-3">
            <Link href={startHref} className="start-orb" aria-label={ar ? "ابدأ" : "Start"}>
              {/* كتل لونية تسبح وتمتزج — بروح كرة Siri */}
              <span className="orb-fluid" aria-hidden>
                <i className="orb-blob b1" />
                <i className="orb-blob b2" />
                <i className="orb-blob b3" />
                <i className="orb-blob b4" />
              </span>
              <span className="orb-label">
                {ar ? "ابدأ" : "Start"}
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={ar ? "rotate-180" : ""}
                >
                  <path d="M5 12h13M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* الجوال: الشبكة أسفل النص */}
      <div className="md:hidden neural-mask px-4 pb-10">
        <NeuralField height={300} />
      </div>
    </main>
  );
}
