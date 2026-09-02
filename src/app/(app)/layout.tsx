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
  if (!user) redirect("/login");

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <div className="flex-1 flex items-stretch">
        <SideRail />
        <div className="flex-1 flex flex-col min-w-0">{children}</div>
      </div>
      <AccountMenu email={user.email ?? null} />
    </div>
  );
}
