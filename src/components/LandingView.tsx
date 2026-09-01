"use client";

// نقطة البداية — الكلام في جهة القراءة الأولى والشبكة العصبية الحية في الجهة المقابلة

import Link from "next/link";
import { toggleLang, useLang } from "@/lib/i18n";
import Logo from "./Logo";
import NeuralField from "./NeuralField";

export default function LandingView({ authed }: { authed: boolean }) {
  const { lang, t } = useLang();
  const ar = lang === "ar";
  const startHref = authed ? "/chat" : "/login";

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-6">
      <div className="card w-full max-w-6xl overflow-hidden relative rise">
        {/* زر اللغة */}
        <button
          onClick={() => toggleLang()}
          className="absolute top-5 z-10 w-11 h-9 rounded-full border border-[var(--line)] bg-[var(--panel-solid)] text-[0.72rem] font-bold text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[var(--accent-bg)] transition-colors"
          style={{ insetInlineEnd: "1.25rem" }}
          title={ar ? "English" : "العربية"}
        >
          {ar ? "EN" : "ع"}
        </button>

        <div className="grid md:grid-cols-[1.05fr_1fr] items-center gap-8 md:gap-4 px-7 sm:px-12 py-14 md:py-20">
          {/* النص — أول عمود (يمين في العربية) */}
          <div className="text-center md:text-start">
            <Link
              href="/"
              className="inline-flex items-center gap-3 mb-8 hover:opacity-85 transition-opacity"
            >
              <Logo size={46} id="wLogoLanding" />
              <span className="text-[1.75rem] font-bold tracking-tight">{t("brand")}</span>
            </Link>

            <h1 className="text-[2.1rem] sm:text-[2.85rem] font-bold leading-[1.24] mb-5 rise-1">
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

            <p className="text-[1.1rem] sm:text-[1.25rem] font-semibold text-[var(--text-soft)] mb-3 tracking-tight rise-2">
              <span className="tag-word">{t("home.w1")}.</span>{" "}
              <span className="tag-word">{t("home.w2")}.</span>{" "}
              <span className="tag-word text-[var(--accent)]">{t("home.w3")}.</span>
            </p>

            <p className="text-[0.85rem] text-[var(--text-soft)] opacity-80 mb-10 max-w-sm mx-auto md:mx-0 leading-relaxed rise-2">
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

          {/* الشبكة العصبية — العمود الثاني (يسار في العربية) */}
          <div className="relative">
            <div className="neural-mask">
              <NeuralField height={420} />
            </div>
            <p className="text-center text-[0.7rem] text-[var(--text-soft)] opacity-60 -mt-2">
              {ar ? "مرّر مؤشرك فوق الشبكة" : "Move your pointer over the network"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
