import { supabaseServer } from "@/lib/supabase/server";
import LandingView from "@/components/LandingView";

// نقطة البداية — تظهر دائمًا كأول شاشة، ومنها «ابدأ» إلى المحادثة
export default async function Landing() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingView authed={Boolean(user)} />;
}
