"use client";

// نقطة البداية — صفحة كاملة بلا إطار: الكلام في جهة القراءة الأولى والشبكة العصبية تملأ الجهة المقابلة

import Link from "next/link";
import { toggleLang, useLang } from "@/lib/i18n";
import Logo from "./Logo";
import NeuralField from "./NeuralField";

export default function LandingView({ authed }: { authed: boolean }) {
  const { lang, t } = useLang();
  const ar = lang === "ar";
  const startHref = authed ? "/chat" : "/login";

  return (
    <main className="flex-1 relative overflow-hidden">
      {/* زر اللغة */}
      <button
        onClick={() => toggleLang()}
        className="absolute top-6 z-20 w-11 h-9 rounded-full border border-[var(--line)] bg-[var(--panel)] backdrop-blur text-[0.72rem] font-bold text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--accent-bg)] transition-colors"
        style={{ insetInlineEnd: "1.75rem" }}
        title={ar ? "English" : "العربية"}
      >
        {ar ? "EN" : "ع"}
      </button>

      {/* الشبكة العصبية تملأ الجهة المقابلة للنص وتمتد خلف الصفحة */}
      <div
        className="neural-mask absolute inset-y-0 hidden md:block w-[58%] pointer-events-auto"
        style={{ insetInlineEnd: 0 }}
      >
        <NeuralField height="100%" />
      </div>

      <div className="relative z-10 min-h-[calc(100vh-2rem)] flex items-center px-7 sm:px-12 md:px-16">
        <div className="w-full md:w-[46%] text-center md:text-start py-14">
          <Link
            href="/"
            className="inline-flex items-center gap-3 mb-9 hover:opacity-85 transition-opacity"
          >
            <Logo size={48} id="wLogoLanding" />
            <span className="text-[1.8rem] font-bold tracking-tight">{t("brand")}</span>
          </Link>

          <h1 className="text-[2.2rem] sm:text-[3rem] font-bold leading-[1.22] mb-5 rise-1">
            {ar ? (
              <>
                حوّل فكرتك إلى{" "}
                <span className="grad-text">سير عمل ذكي</span>
              </>
            ) : (
              <>
                Turn your idea into a{" "}
                <span className="grad-text">smart workflow</span>
              </>
            )}
          </h1>

          <p className="text-[1.1rem] sm:text-[1.3rem] font-semibold text-[var(--text-soft)] mb-3 tracking-tight rise-2">
            <span className="tag-word">{t("home.w1")}.</span>{" "}
            <span className="tag-word">{t("home.w2")}.</span>{" "}
            <span className="tag-word text-[var(--accent)]">{t("home.w3")}.</span>
          </p>

          <p className="text-[0.88rem] text-[var(--text-soft)] opacity-80 mb-11 max-w-sm mx-auto md:mx-0 leading-relaxed rise-2">
            {ar
              ? "صف مهمتك المتكررة بجملة واحدة — ووَتيرة يبنيها أتمتة تعمل عنك."
              : "Describe your recurring task in one line — Wateera builds the automation for you."}
          </p>

          <div className="flex justify-center md:justify-start rise-3">
            <Link href={startHref} className="start-orb" aria-label={ar ? "ابدأ" : "Start"}>
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
