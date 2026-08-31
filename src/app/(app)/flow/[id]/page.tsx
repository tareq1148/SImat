import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { activeConnections } from "@/lib/connections";
import StatusChip from "@/components/StatusChip";
import FlowWorkspace from "@/components/FlowWorkspace";
import type {
  ConnectionRow,
  Evaluation,
  FlowRow,
  WorkflowIR,
} from "@/lib/types";

export default async function FlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("id", id)
    .single();
  if (!flow) notFound();

  const [{ data: versionRow }, { data: conns }] = await Promise.all([
    supabase
      .from("flow_versions")
      .select("ir")
      .eq("flow_id", id)
      .eq("version", flow.current_version)
      .maybeSingle(),
    supabase
      .from("connections")
      .select("id, provider, label, status, n8n_credential_id, metadata")
      .eq("status", "connected"),
  ]);

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <Link href="/chat" className="text-xs text-slate-400 hover:text-white">
            → الرئيسية
          </Link>
          <h1 className="text-2xl font-bold mt-1">{flow.name}</h1>
        </div>
        <StatusChip status={flow.status} />
      </div>

      <FlowWorkspace
        flow={flow as FlowRow}
        ir={(versionRow?.ir as WorkflowIR) ?? null}
        evaluation={(flow.evaluation as Evaluation) ?? null}
        initialConnections={activeConnections(conns) as ConnectionRow[]}
        initialTab={tab ?? "evaluation"}
      />
    </main>
  );
}
