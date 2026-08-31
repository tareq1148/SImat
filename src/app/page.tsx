import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Landing() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2 chip border-cyan-400/30 text-cyan-300 bg-cyan-400/5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
          نسخة تجريبية — MVP
        </div>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 bg-gradient-to-l from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
          سِمَاط
        </h1>
        <p className="text-xl text-slate-300 mb-3 leading-relaxed">
          صف مهمتك بلغتك الطبيعية — وسنحوّلها إلى أتمتة تعمل فعليًا.
        </p>
        <p className="text-sm text-slate-400 mb-10 leading-relaxed max-w-xl mx-auto">
          مقابلة قصيرة، تقييم مُفسَّر بقواعد واضحة، رسم بصري يطابق التنفيذ، اختبار
          قبل التشغيل، وموافقتك شرط لأي إرسال أو حذف.
        </p>
        <Link href="/login" className="btn btn-primary text-base px-8 py-3">
          ابدأ الآن ←
        </Link>
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-400">
          {[
            ["🎙️", "مقابلة ذكية تجمع التفاصيل"],
            ["⚖️", "تقييم قاعدي قابل للتفسير"],
            ["🧩", "رسم بصري يطابق التنفيذ"],
            ["🛡️", "موافقة إلزامية للإجراءات الحساسة"],
          ].map(([icon, label]) => (
            <div key={label} className="card p-4">
              <div className="text-2xl mb-2">{icon}</div>
              {label}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
