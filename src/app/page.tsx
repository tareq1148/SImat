import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import LandingView from "@/components/LandingView";

export default async function Landing() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/chat");

  return <LandingView />;
}
