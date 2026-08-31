import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ProgressView from "@/components/ProgressView";

export default async function ProgressPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
      <ProgressView />
    </main>
  );
}
