import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import WorkflowsView from "@/components/WorkflowsView";
import type { FlowStatus } from "@/lib/types";

export default async function WorkflowsPage() {
  const supabase = await supabaseServer();
  // متوازيان لا متتاليان: التحقق من الجلسة وجلب المسارات كانا رحلتين متعاقبتين
  // إلى Supabase، وهذا وحده كان يضاعف زمن فتح الصفحة
  const [{ data: auth }, { data: flows }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("flows")
      .select("id, name, status")
      .order("updated_at", { ascending: false }),
  ]);
  if (!auth.user) redirect("/login");

  return (
    <WorkflowsView
      flows={(flows ?? []) as { id: string; name: string; status: FlowStatus }[]}
    />
  );
}
