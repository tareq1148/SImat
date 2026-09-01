import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import AccountMenu from "@/components/AccountMenu";

// تخطيط القسم المسجَّل: شريط علوي بالتبويبات فقط + قائمة الحساب في الزاوية السفلية
// (أُزيل الشريط الجانبي لصالح المظهر النظيف الفسيح)
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
      <TopBar />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
      <AccountMenu email={user.email ?? null} />
    </div>
  );
}
