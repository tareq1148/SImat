import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SearchView, { type SearchFlow } from "@/components/SearchView";
import type { FlowStatus, Provider, WorkflowIR } from "@/lib/types";

// البحث في المسارات: الاسم والحالة والخدمات المستعملة.
// الخدمات تُستخرج هنا من إصدار كل مسار — لتصفيتها في المتصفح بلا طلبات إضافية.
export default async function SearchPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/api/auth/guest?next=/search");

  const [{ data: flows }, { data: versions }] = await Promise.all([
    supabase
      .from("flows")
      .select("id, name, status, current_version, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("flow_versions").select("flow_id, version, ir"),
  ]);

  const irOf = new Map<string, WorkflowIR>();
  (versions ?? []).forEach((v) => {
    const row = v as { flow_id: string; version: number; ir: WorkflowIR };
    irOf.set(`${row.flow_id}:${row.version}`, row.ir);
  });

  const items: SearchFlow[] = (flows ?? []).map((f) => {
    const row = f as {
      id: string;
      name: string;
      status: FlowStatus;
      current_version: number;
      updated_at: string;
    };
    const ir = irOf.get(`${row.id}:${row.current_version}`);
    const providers = [
      ...new Set(
        (ir?.nodes ?? [])
          .map((n) => n.provider)
          .filter((p): p is Provider => !!p)
      ),
    ];
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      updatedAt: row.updated_at,
      providers,
    };
  });

  return <SearchView flows={items} />;
}
