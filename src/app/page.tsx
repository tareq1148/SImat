import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const FEATURES: { icon: React.ReactNode; title: string; desc: string }[] = [
  {
    icon: <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 1 0-7 0v5A3.5 3.5 0 0 0 12 15zM6 11.5a6 6 0 0 0 12 0M12 17.5V21" />,
    title: "مقابلة خاطفة",
    desc: "صف مهمتك بجملة — سؤالان بحد أقصى بخيارات جاهزة، والباقي علينا.",
  },
  {
    icon: <path d="M12 3v4M7 21h10M12 7 5 12h4l-1 5 8-6h-4l1-4h3l-4-4z M5 12l1 5M19 12l-1 5" />,
    title: "تقييم شفاف",
    desc: "قرار الجدوى يصدر بقواعد واضحة قابلة للتفسير — لا صندوق أسود.",
  },
  {
    icon: <path d="M6 5h5v5H6zM13 14h5v5h-5zM8.5 10v4a2 2 0 0 0 2 2h2.5" />,
    title: "رسم يطابق التنفيذ",
    desc: "ما تراه على اللوحة هو حرفيًا ما يعمل في محرك التنفيذ.",
  },
  {
    icon: <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3zM9.5 12l2 2 3.5-4" />,
    title: "موافقة إلزامية",
    desc: "لا يُرسَل بريد أو منشور باسمك أبدًا إلا بعد موافقتك داخل المنصة.",
  },
];

export default async function Landing() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex-1 flex flex-col">
      <header className="max-w-5xl mx-auto w-full px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-[10px] text-white text-[0.95rem] font-bold flex items-center justify-center"
            style={{ background: "var(--accent-bg)" }}
          >
            س
          </span>
          <span className="text-[1.05rem] font-bold">سِمَاط</span>
        </div>
        <Link href="/login" className="btn btn-ghost text-[0.8rem] py-2">
          تسجيل الدخول
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        <div className="max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 chip chip-neutral">
            <span className="status-dot" style={{ background: "var(--ok)" }} />
            متصل بمحرك تنفيذ حقيقي — ليس عرضًا تجريبيًا
          </div>

          <h1 className="text-4xl md:text-[3.2rem] font-bold leading-[1.2] mb-5">
            أتمت عملك اليومي المتكرر
          </h1>
          <p className="text-base md:text-lg text-[var(--text-soft)] mb-9 leading-relaxed max-w-xl mx-auto">
            صف مهمتك بلغتك الطبيعية، وسيحوّلها سِمَاط إلى أتمتة تعمل فعليًا —
            من المقابلة إلى التشغيل، وموافقتك شرط لأي إجراء حساس.
          </p>

          <div className="flex items-center justify-center gap-3 mb-16">
            <Link href="/login" className="btn btn-primary text-[0.95rem] px-7 py-3">
              ابدأ الآن
            </Link>
            <a href="#how" className="btn btn-ghost text-[0.95rem] px-6 py-3">
              كيف يعمل؟
            </a>
          </div>

          <div id="how" className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5 flex gap-3.5">
                <span className="w-9 h-9 rounded-[10px] bg-[var(--well)] text-[var(--accent)] flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <span>
                  <span className="block font-semibold text-[0.88rem] mb-1">{f.title}</span>
                  <span className="block text-[0.78rem] text-[var(--text-soft)] leading-relaxed">
                    {f.desc}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
