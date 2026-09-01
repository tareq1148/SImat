"use client";

// نقطة البداية — بروح تصميم المستخدم: شعار وَتيرة، عبارة متدرجة، شبكة عصبية حية، وكرة «ابدأ»

import Link from "next/link";
import { toggleLang, useLang } from "@/lib/i18n";
import Logo from "./Logo";
import NeuralField from "./NeuralField";

export default function LandingView() {
  const { lang } = useLang();
  const ar = lang === "ar";

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-6">
      <div className="card w-full max-w-6xl overflow-hidden relative rise">
        {/* زر اللغة */}
        <button
          onClick={() => toggleLang()}
          className="absolute top-5 inline-start-5 z-10 w-11 h-9 rounded-full border border-[var(--line)] bg-[var(--panel-solid)] text-[0.72rem] font-bold text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
          style={{ insetInlineStart: "1.25rem" }}
          title={ar ? "English" : "العربية"}
        >
          {ar ? "EN" : "ع"}
        </button>

        <div className="grid md:grid-cols-2 items-center gap-6 px-6 sm:px-10 py-12 md:py-16">
          {/* يمين: الشعار + العبارة + الكرة */}
          <div className="order-1 md:order-2 text-center md:text-start">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-9">
              <Logo size={44} />
              <span className="text-[1.7rem] font-bold tracking-tight">
                {ar ? "وَتيرة" : "وَتيرة"}
              </span>
            </div>

            <h1 className="text-[2rem] sm:text-[2.6rem] font-bold leading-[1.25] mb-10">
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

            <div className="flex justify-center md:justify-start">
              <Link href="/login" className="start-orb" aria-label={ar ? "ابدأ" : "Start"}>
                {ar ? "ابدأ" : "Start"}
              </Link>
            </div>
          </div>

          {/* يسار: الشبكة العصبية الحية والتفاعلية */}
          <div className="order-2 md:order-1">
            <NeuralField height={380} />
            <p className="text-center text-[0.72rem] text-[var(--text-soft)] mt-1">
              {ar ? "مرّر مؤشرك فوق الشبكة" : "Move your pointer over the network"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
