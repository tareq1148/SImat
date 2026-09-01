import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FlowEditWorkspace from "@/components/FlowEditWorkspace";
import { toTranscript } from "@/lib/transcript";

// فتح مسار من «مساراتك» = مساحة العمل نفسها: اللوحة يسارًا والمحادثة يمينًا،
// وفيها محادثة المقابلة التي وُلد منها المسار.
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
    .select("id, name, task_spec_id")
    .eq("id", id)
    .single();
  if (!flow) notFound();

  // نصّ المقابلة محفوظ مع المواصفة لا مع المسار
  const { data: spec } = flow.task_spec_id
    ? await supabase
        .from("task_specs")
        .select("interview_messages")
        .eq("id", flow.task_spec_id)
        .maybeSingle()
    : { data: null };

  return (
    <FlowEditWorkspace
      flowId={flow.id}
      flowName={flow.name}
      history={toTranscript(spec?.interview_messages)}
    />
  );
}
