import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

// تخطيط القسم المسجَّل: شريط جانبي يمين + محتوى الصفحة
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
    <div className="flex-1 flex flex-col md:flex-row min-h-screen">
      <Sidebar email={user.email ?? null} />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}
