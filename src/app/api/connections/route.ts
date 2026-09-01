import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createN8nCredential, hasN8nKey } from "@/lib/n8n";
import { PROVIDER_LABELS, type Provider } from "@/lib/types";
import { activeConnections } from "@/lib/connections";

// خريطة اتصالات المنصة: حسابات Google مربوطة مسبقًا في المحرك لحساب هذا المستخدم الأول
// (OAuth لكل مستخدم على حدة يأتي في مرحلة لاحقة — PRD يسمح بمستخدم واحد في MVP)
const PLATFORM_CREDS: Record<Provider, string | undefined> = {
  gmail: process.env.N8N_CRED_GMAIL,
  google_sheets: process.env.N8N_CRED_SHEETS,
  google_drive: process.env.N8N_CRED_DRIVE,
  // الثلاثة تُربط عبر OAuth لا باعتماد منصة
  google_slides: undefined,
  google_calendar: undefined,
  google_docs: undefined,
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
    .select("id, provider, label, status, n8n_credential_id, metadata")
    .eq("status", "connected");
  return Response.json({ connections: activeConnections(data) });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const body = (await req.json()) as {
    provider: Provider;
    token?: string;
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

  // التوكن الخاص بالمستخدم يُخزَّن كسر داخل خزنة المحرك فقط؛ المنصة تحتفظ بمرجع الاتصال لا بالمفتاح
  const TOKEN_CREDS: Partial<
    Record<Provider, (t: string) => { type: string; data: Record<string, string> }>
  > = {
    openai: (t) => ({ type: "openAiApi", data: { apiKey: t } }),
    telegram: (t) => ({ type: "telegramApi", data: { accessToken: t } }),
    slack: (t) => ({ type: "slackApi", data: { accessToken: t } }),
    tiktok: (t) => ({
      type: "httpHeaderAuth",
      data: { name: "Authorization", value: `Bearer ${t}` },
    }),
  };

  const token = (body.token ?? body.openai_api_key)?.trim();
  const maker = TOKEN_CREDS[body.provider];
  const metadata: Record<string, string> = { source: token && maker ? "user" : "platform" };
  let botInfo: { username: string; chat_id: string | null } | null = null;

  if (token && maker) {
    if (!hasN8nKey()) {
      return Response.json(
        { error: "لا يمكن حفظ المفتاح الآن — مفتاح محرك التنفيذ غير مضبوط (N8N_API_KEY)" },
        { status: 500 }
      );
    }

    // تيليجرام: تحقق حقيقي من التوكن + التقاط chat_id تلقائيًا من رسالة /start
    if (body.provider === "telegram") {
      const me = await fetch(`https://api.telegram.org/bot${token}/getMe`)
        .then((r) => r.json())
        .catch(() => null);
      if (!me?.ok) {
        return Response.json(
          { error: "توكن تيليجرام غير صحيح — انسخه من @BotFather كما هو (بالنقطتين والشرطة)" },
          { status: 400 }
        );
      }
      const updates = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10`)
        .then((r) => r.json())
        .catch(() => null);
      const lastChat = (updates?.result ?? [])
        .map((u: { message?: { chat?: { id?: number } } }) => u.message?.chat?.id)
        .filter(Boolean)
        .pop();
      botInfo = {
        username: me.result.username as string,
        chat_id: lastChat ? String(lastChat) : null,
      };
      label = `Telegram (@${botInfo.username})`;
      if (botInfo.chat_id) metadata.chat_id = botInfo.chat_id;
    }

    const { type, data } = maker(token);
    const cred = await createN8nCredential(
      `muhawwil-${body.provider}-${user.id.slice(0, 8)}`,
      type,
      data
    );
    credentialId = cred.id;
    if (body.provider !== "telegram")
      label = `${PROVIDER_LABELS[body.provider]} (حسابك)`;
  } else {
    credentialId = PLATFORM_CREDS[body.provider];
    if (!credentialId) {
      return Response.json(
        {
          error: maker
            ? `أدخل توكن ${PROVIDER_LABELS[body.provider]} الخاص بك — اتبع الخطوات أعلاه للحصول عليه`
            : `اتصال ${PROVIDER_LABELS[body.provider]} غير متاح حاليًا`,
        },
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
      metadata,
    },
    { onConflict: "user_id,provider" }
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, provider: body.provider, label, bot: botInfo });
}
