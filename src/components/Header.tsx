"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Header({ email }: { email: string | null }) {
  const router = useRouter();
  return (
    <header className="border-b border-[#1c2740] bg-[#0c1120]/70 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 text-[#06121f] text-sm font-bold flex items-center justify-center">س</span>
          <span className="bg-gradient-to-l from-cyan-300 to-violet-300 bg-clip-text text-transparent">
            سِمَاط
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <Link href="/progress" className="hover:text-cyan-300 font-semibold">
            📈 إنجازاتي
          </Link>
          {email && <span dir="ltr" className="hidden md:block">{email}</span>}
          <button
            className="btn btn-ghost text-xs py-1.5"
            onClick={async () => {
              await supabaseBrowser().auth.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
