import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import WorkflowsView from "@/components/WorkflowsView";
import type { FlowStatus } from "@/lib/types";

export default async function WorkflowsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: flows } = await supabase
    .from("flows")
    .select("id, name, status")
    .order("updated_at", { ascending: false });

  return (
    <WorkflowsView
      flows={(flows ?? []) as { id: string; name: string; status: FlowStatus }[]}
    />
  );
}
