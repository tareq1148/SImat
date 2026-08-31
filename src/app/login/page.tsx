"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setMsg(err);
  }, [searchParams]);

  async function googleSignIn() {
    setBusy(true);
    setMsg(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMsg(
        error.message.includes("not enabled") || error.message.includes("Unsupported")
          ? "دخول Google لم يُفعَّل بعد في إعدادات المنصة — استخدم البريد مؤقتًا."
          : error.message
      );
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setMsg("أرسلنا رابط تأكيد إلى بريدك — افتحه ثم عد لتسجيل الدخول.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-1">
          {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          محادثاتك ومساراتك واتصالاتك مرتبطة بحسابك وحدك.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <input
            className="input"
            type="email"
            dir="ltr"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            dir="ltr"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? "لحظة..." : mode === "signin" ? "دخول" : "إنشاء الحساب"}
          </button>
        </form>
        {msg && (
          <p className="mt-4 text-sm text-amber-300 leading-relaxed">{msg}</p>
        )}
        <button
          className="mt-4 text-sm text-cyan-300 hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "ما عندك حساب؟ أنشئ واحدًا" : "عندك حساب؟ سجّل الدخول"}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[var(--line)]" />
          <span className="text-[0.7rem] text-slate-500">أو</span>
          <div className="flex-1 h-px bg-[var(--line)]" />
        </div>

        <button
          onClick={googleSignIn}
          disabled={busy}
          className="btn btn-ghost w-full justify-center gap-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          الدخول بحساب Google
        </button>

        <div className="btn btn-ghost w-full justify-center gap-3 mt-2 opacity-45 cursor-not-allowed">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg>
          الدخول بحساب Microsoft
          <span className="chip text-[0.6rem] px-2 py-0 border-slate-500/40 text-slate-400 bg-slate-500/10">قريبًا</span>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
