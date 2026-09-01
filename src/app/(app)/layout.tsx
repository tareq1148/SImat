import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import SideRail from "@/components/SideRail";

// تخطيط القسم المسجَّل: شريط علوي بالتبويبات + شريط جانبي يمين قابل للطي
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
      <TopBar email={user.email ?? null} />
      <div className="flex-1 flex items-stretch">
        <SideRail email={user.email ?? null} />
        <div className="flex-1 flex flex-col min-w-0">{children}</div>
      </div>
    </div>
  );
}
