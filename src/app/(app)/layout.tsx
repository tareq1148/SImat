import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SideRail from "@/components/SideRail";
import AccountMenu from "@/components/AccountMenu";

// تخطيط القسم المسجَّل: شريط علوي بالتبويبات + شريط جانبي يمين قابل للطي
// + قائمة الحساب في الزاوية السفلية (تحمل السمة والخروج المُزالَين من الترويسة)
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // من لا جلسة له يصير ضيفًا ويكمل — لا يُردّ إلى صفحة دخول
  if (!user) redirect("/api/auth/guest");

  // الضيف يُخبَر أنه ضيف: عملُه قائمٌ على جلسةٍ لا بريد لها، ولو مسحها
  // المتصفّح ذهبت. والصمت هنا يوهمه بحسابٍ ليس له.
  const guest = user.is_anonymous === true;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {guest && (
        <p className="shrink-0 text-center text-[0.72rem] py-1.5 bg-[var(--accent-soft)] border-b border-[var(--line)]">
          أنت تجرّب كضيف —{" "}
          <a href="/login" className="font-semibold underline">
            سجّل دخولك
          </a>{" "}
          لتحفظ مساراتك وتربط حساباتك.
        </p>
      )}
      <div className="flex-1 flex items-stretch">
        <SideRail />
        <div className="flex-1 flex flex-col min-w-0">{children}</div>
      </div>
      <AccountMenu email={user.email ?? null} />
    </div>
  );
}
