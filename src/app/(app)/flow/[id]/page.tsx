import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FlowEditWorkspace from "@/components/FlowEditWorkspace";

// فتح مسار من «مساراتك» = مساحة العمل نفسها: اللوحة يسارًا والمحادثة يمينًا.
export default async function FlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: flow } = await supabase
    .from("flows")
    .select("id, name")
    .eq("id", id)
    .single();
  if (!flow) notFound();

  return <FlowEditWorkspace flowId={flow.id} flowName={flow.name} />;
}
