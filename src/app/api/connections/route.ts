import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createN8nCredential, hasN8nKey } from "@/lib/n8n";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";

// خريطة اتصالات المنصة: حسابات Google مربوطة مسبقًا في المحرك لحساب هذا المستخدم الأول
// (OAuth لكل مستخدم على حدة يأتي في مرحلة لاحقة — PRD يسمح بمستخدم واحد في MVP)
const PLATFORM_CREDS: Record<Provider, string | undefined> = {
  gmail: process.env.N8N_CRED_GMAIL,
  google_sheets: process.env.N8N_CRED_SHEETS,
  google_drive: process.env.N8N_CRED_DRIVE,
  openai: process.env.N8N_CRED_OPENAI,
  telegram: process.env.N8N_CRED_TELEGRAM,
  slack: process.env.N8N_CRED_SLACK,
  instagram: process.env.N8N_CRED_INSTAGRAM,
  tiktok: process.env.N8N_CRED_TIKTOK,
};

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { data } = await supabase
    .from("connections")
    .select("id, provider, label, status, n8n_credential_id")
    .eq("status", "connected");
  return Response.json({ connections: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const body = (await req.json()) as {
    provider: Provider;
    openai_api_key?: string;
    revoke?: boolean;
  };

  if (body.revoke) {
    await supabase
      .from("connections")
      .update({ status: "revoked" })
      .eq("provider", body.provider);
    return Response.json({ ok: true });
  }

  let credentialId: string | undefined;
  let label = PROVIDER_LABELS[body.provider];

  if (body.provider === "openai" && body.openai_api_key) {
    // مفتاح المستخدم يُخزَّن كسر داخل خزنة المحرك فقط؛ منصتنا تحتفظ بمرجع الاتصال لا بالمفتاح
    if (!hasN8nKey()) {
      return Response.json(
        { error: "لا يمكن حفظ المفتاح الآن — مفتاح محرك التنفيذ غير مضبوط (N8N_API_KEY)" },
        { status: 500 }
      );
    }
    const cred = await createN8nCredential(
      `muhawwil-openai-${user.id.slice(0, 8)}`,
      "openAiApi",
      { apiKey: body.openai_api_key }
    );
    credentialId = cred.id;
    label = "OpenAI (مفتاحك الخاص)";
  } else {
    credentialId = PLATFORM_CREDS[body.provider];
    if (!credentialId) {
      return Response.json(
        { error: `اتصال ${PROVIDER_LABELS[body.provider]} غير متاح — أضف معرف الاعتماد في الإعدادات` },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.from("connections").upsert(
    {
      user_id: user.id,
      provider: body.provider,
      label,
      n8n_credential_id: credentialId,
      status: "connected",
    },
    { onConflict: "user_id,provider" }
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, provider: body.provider, label });
}
