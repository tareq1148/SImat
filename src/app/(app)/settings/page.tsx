"use client";

// شاشة الإعدادات — الحساب، الصوت، المظهر، ومعلومات المحرك

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [speak, setSpeak] = useState(false);

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
    try {
      setSpeak(localStorage.getItem("mv_speak") === "1");
    } catch {}
  }, []);

  function toggleSpeak() {
    setSpeak((v) => {
      try {
        localStorage.setItem("mv_speak", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">الإعدادات</h1>
        <p className="text-sm text-slate-400">حسابك وتفضيلاتك في سِمَاط.</p>
      </div>

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="font-bold text-sm mb-4">👤 الحساب</h2>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-slate-400 mb-1">البريد الإلكتروني</p>
              <p dir="ltr" className="text-sm text-slate-200 text-right">
                {email ?? "..."}
              </p>
            </div>
            <button className="btn btn-ghost text-xs hover:!text-red-300" onClick={signOut}>
              تسجيل الخروج
            </button>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-bold text-sm mb-4">🎙️ الصوت</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-200 mb-1">اسمع ردود سِمَاط صوتيًا</p>
              <p className="text-xs text-slate-400">
                في شاشة المحادثة تُنطق الردود تلقائيًا عند التفعيل.
              </p>
            </div>
            <button
              onClick={toggleSpeak}
              className={`chip cursor-pointer transition-colors ${
                speak
                  ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10"
                  : "border-slate-500/40 text-slate-400 bg-slate-500/5"
              }`}
            >
              {speak ? "🔊 مفعّل" : "🔇 متوقف"}
            </button>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-bold text-sm mb-4">🌙 المظهر</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-200 mb-1">الوضع الداكن</p>
              <p className="text-xs text-slate-400">
                هوية سِمَاط البصرية داكنة دائمًا — مريحة للعين في جلسات العمل الطويلة.
              </p>
            </div>
            <span className="chip border-cyan-400/30 text-cyan-300 bg-cyan-400/5">مفعّل</span>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-bold text-sm mb-4">⚙️ محرك التنفيذ</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            مساراتك تعمل على محرك تنفيذ سحابي تديره المنصة بالكامل. مفاتيح
            حساباتك المرتبطة تُحفظ مشفّرة داخل خزنة المحرك — المنصة تحتفظ
            بمراجع الاتصال فقط، ولا يُنفَّذ أي إرسال حسّاس دون موافقتك داخل
            المنصة.
          </p>
        </section>
      </div>
    </main>
  );
}
