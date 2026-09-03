import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { irToN8n, missingProviders, type CredentialMap } from "@/lib/adapter";
import { activeConnections } from "@/lib/connections";
import { validateIR } from "@/lib/validate-ir";
import { stripApprovals } from "@/lib/ir";
import {
  bareSheetName,
  ensureFolder,
  ensureSheetTab,
  ensureSpreadsheet,
  listSpreadsheets,
} from "@/lib/google-lookup";
import { resolveTelegramChatId } from "@/lib/telegram-chat";
import {
  activateWorkflow,
  createWorkflow,
  friendlyBuildError,
  hasN8nKey,
  updateWorkflow,
} from "@/lib/n8n";
import type { Provider, WorkflowIR } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "غير مسجل الدخول" }, { status: 401 });

  const { data: flow } = await supabase
    .from("flows")
    .select("*")
    .eq("id", id)
    .single();
  if (!flow) return Response.json({ error: "سير العمل غير موجود" }, { status: 404 });

  const { data: versionRow } = await supabase
    .from("flow_versions")
    .select("*")
    .eq("flow_id", id)
    .eq("version", flow.current_version)
    .single();
  if (!versionRow)
    return Response.json({ error: "لا يوجد إصدار للبناء" }, { status: 400 });

  const ir = stripApprovals(versionRow.ir as WorkflowIR);

  // الاتصالات المطلوبة
  const { data: rawConns } = await supabase
    .from("connections")
    .select("provider, label, n8n_credential_id, metadata")
    .eq("status", "connected");
  // اتصالات المواقع ذات الـAPI لا تُحتسب إلا إذا سجّل المستخدم بياناتها بنفسه
  const conns = activeConnections(rawConns);

  // بوت تيليجرام المتصل: نكمّل chat_id تلقائيًا لأي عقدة تنقصه — حتى تصل الرسالة فعليًا
  const tgMeta = (conns ?? []).find((c) => c.provider === "telegram")?.metadata as
    | { chat_id?: string }
    | undefined;
  const tgNodes = ir.nodes.filter(
    (n) => n.provider === "telegram" && !n.params.chat_id
  );
  if (tgNodes.length > 0) {
    // المحفوظ عند الربط أولًا، وإلا نسأل تيليجرام مباشرةً — فمن راسل بوته
    // بعد الربط يُلتقط معرّفه هنا بلا أن يُطالَب بإعادة إدخال التوكن.
    let chatId = tgMeta?.chat_id ? String(tgMeta.chat_id) : null;
    if (!chatId) chatId = await resolveTelegramChatId(user.id);
    if (chatId) {
      tgNodes.forEach((n) => (n.params.chat_id = chatId));
      // يُحفظ ليُستعمل مباشرةً في البناءات التالية
      await supabase
        .from("connections")
        .update({ metadata: { ...(tgMeta ?? {}), chat_id: chatId } })
        .eq("provider", "telegram")
        .eq("status", "connected");
    }
  }

  // المستخدم ربط حسابه وسمّى ما يريد في كلامه، فالمنصّة تتكفّل بالباقي:
  // تبحث عنه في حسابه، وتُنشئه إن لم تجده. وكان الغائب يوقف المسار
  // ويطالبه بما لا يملك — فيخرج ليصنعه بيده ثم يعود.
  const created: string[] = [];
  let irChanged = false;

  // خطوةُ جداولٍ بلا جدولٍ تخصّها ترث جدول ما قبلها: المسار الواحد يعمل على
  // مستندٍ واحد في الغالب، والنموذج يسمّيه في أوّل خطوة ثم يسكت عنه فيما
  // بعدها. وكان سكوته يوقف المسار طالبًا اسمًا قاله المستخدم مرّةً وكفى.
  let carriedDoc: { url?: string; name?: string } | null = null;
  for (const node of ir.nodes.filter((n) => n.provider === "google_sheets")) {
    const hasOwn =
      String(node.params.spreadsheet_url ?? "").trim() ||
      String(node.params.spreadsheet_name ?? "").trim();
    if (hasOwn) {
      carriedDoc = {
        url: node.params.spreadsheet_url,
        name: node.params.spreadsheet_name,
      };
    } else if (carriedDoc) {
      if (carriedDoc.url) node.params.spreadsheet_url = carriedDoc.url;
      if (carriedDoc.name) node.params.spreadsheet_name = carriedDoc.name;
      irChanged = true;
    }
  }

  for (const node of ir.nodes.filter((n) => n.provider === "google_sheets")) {
    const byDoc = String(node.params.spreadsheet_name ?? "").trim();
    // النموذج يخلط أحيانًا بين اسم المستند واسم الورقة — «جدول اسمه منتجات»
    // يحتملهما. فإن لم يُسمَّ المستند حُمل اسم الورقة عليه.
    const byTab = String(node.params.sheet_name ?? "").trim();
    const docName = byDoc || byTab;

    if (!node.params.spreadsheet_url && docName) {
      const doc = await ensureSpreadsheet(user.id, docName);
      if (doc) {
        node.params.spreadsheet_url = doc.id;
        irChanged = true;
        if (doc.created)
          created.push(`جدول «${bareSheetName(docName) || docName}»`);
        // كان الاسم للمستند لا لورقةٍ فيه — يُترك ليقع على الورقة الأولى
        if (!byDoc && byTab) delete node.params.sheet_name;
      }
    }

    // الورقة لسانٌ داخل الجدول لا ملفّ في درايف: تُنشأ بواجهة الجداول
    const tab = String(node.params.sheet_name ?? "").trim();
    const docId = String(node.params.spreadsheet_url ?? "");
    if (docId && tab) {
      const made = await ensureSheetTab(user.id, docId, tab);
      if (made?.created) created.push(`ورقة «${tab}»`);
    }
  }

  // مجلّد الحفظ لمن يكتب في درايف — بالاسم، ويُنشأ إن لم يوجد
  for (const node of ir.nodes.filter(
    (n) => n.provider === "google_drive" || n.provider === "google_docs"
  )) {
    const name = String(node.params.folder_name ?? "").trim();
    if (!name || node.params.folder_id) continue;
    const folder = await ensureFolder(user.id, name);
    if (folder) {
      node.params.folder_id = folder.id;
      irChanged = true;
      if (folder.created) created.push(`مجلّد «${name}»`);
    }
  }

  // المعرّفات تُثبَّت في الإصدار: بدونها يُبحث في كل بناء من جديد، وقد
  // يُنشأ نظيرٌ ثانٍ لما أُنشئ قبل قليل
  if (irChanged) {
    await supabase.from("flow_versions").update({ ir }).eq("id", versionRow.id);
  }

  const credMap: CredentialMap = {};
  (conns ?? []).forEach((c) => {
    if (c.n8n_credential_id) {
      credMap[c.provider as Provider] = {
        id: c.n8n_credential_id,
        name: c.label,
      };
    }
  });

  // OpenAI بنية تحتية تقدّمها المنصة، لا حساب شخصي: كل سلسلة تأليف نص تحتاجه،
  // فلا معنى لمطالبة المستخدم بربطه. نسقط على اعتماد المنصة تلقائيًا عند غيابه.
  // (بقية المزوّدين لا يسقطون: Gmail وتيليجرام وسلاك حسابات المستخدم نفسه.)
  if (!credMap.openai && process.env.N8N_CRED_OPENAI) {
    credMap.openai = { id: process.env.N8N_CRED_OPENAI, name: "OpenAI (المنصة)" };
  }
  // OpenAI أُخفي من واجهة الاتصالات لأن المنصة توفّره — فلو غاب اعتماده صار المسار
  // عالقًا بلا زرّ يحلّه. نرد خطأ إداريًا صريحًا بدل «اربط OpenAI» الذي لا يملك
  // المستخدم فعله.
  if (!credMap.openai && missingProviders(ir, credMap).includes("openai")) {
    return Response.json(
      {
        error:
          "اعتماد OpenAI غير مضبوط على المنصة (N8N_CRED_OPENAI في .env.local) — " +
          "المسار يحتاجه لتأليف النصوص. أنشئ اعتماد openAiApi في n8n وضع معرّفه هناك.",
      },
      { status: 500 }
    );
  }

  // remove.bg تقدّمها المنصّة بمفتاح في البيئة. لو غاب المفتاح فالمستخدم لا
  // يملك حلًّا — نردّ خطأً إداريًا صريحًا بدل بناء مسار يفشل بـ403 عند التنفيذ.
  if (
    !process.env.REMOVEBG_API_KEY &&
    ir.nodes.some((n) => n.provider === "removebg")
  ) {
    return Response.json(
      {
        error:
          "مفتاح remove.bg غير مضبوط على المنصة (REMOVEBG_API_KEY في .env.local) — " +
          "المسار يحتاجه لإزالة خلفية الصور.",
      },
      { status: 500 }
    );
  }

  // فحص حتمي: أي عقدة تنقصها حقول؟ (بعد الحقن التلقائي لـchat_id)
  const blocking = validateIR(ir);
  if (blocking.length > 0) {
    // نقص الجدول وحسابه مربوط: نسمّي له جداوله بدل أن نطلب رابطًا يبحث عنه.
    // فالربط أعطانا Drive حسابه، والاسم يكفينا لنحلّه بأنفسنا.
    const needsSheet = blocking.some((b) =>
      b.missing.some((m) => m.field === "spreadsheet_url")
    );
    const sheets = needsSheet
      ? (await listSpreadsheets(user.id)).map((f) => f.name)
      : [];

    await supabase
      .from("flows")
      .update({ status: "NeedsInformation", blocking })
      .eq("id", id);
    return Response.json({ status: "NeedsInformation", blocking, sheets, created });
  }

  const missing = missingProviders(ir, credMap);
  if (missing.length > 0) {
    await supabase
      .from("flows")
      .update({ status: "NeedsConnections" })
      .eq("id", id);
    return Response.json({ status: "NeedsConnections", missing });
  }

  if (!hasN8nKey()) {
    return Response.json(
      {
        error:
          "مفتاح محرك التنفيذ غير مضبوط (N8N_API_KEY في .env.local) — لا يمكن إنشاء سير العمل.",
      },
      { status: 500 }
    );
  }

  const payload = irToN8n(ir, credMap, flow.id);

  let n8nId = flow.n8n_workflow_id as string | null;
  try {
    if (n8nId) {
      await updateWorkflow(n8nId, payload);
    } else {
      const created = await createWorkflow(payload);
      n8nId = created.id;
      // نحفظ المعرف فورًا حتى لا تتكرر النسخ لو فشل التفعيل
      await supabase.from("flows").update({ n8n_workflow_id: n8nId }).eq("id", id);
    }
    await supabase
      .from("flow_versions")
      .update({ n8n_payload: payload })
      .eq("id", versionRow.id);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "خطأ غير متوقع";
    return Response.json(
      { error: friendlyBuildError(raw, payload) },
      { status: 502 }
    );
  }

  try {
    await activateWorkflow(n8nId);
  } catch (err) {
    // فشل التفعيل غالبًا = معلومات ناقصة في عقدة (PRD 10.7: نحدد العقدة والحقل)
    const raw = err instanceof Error ? err.message : "";
    const nodeMatch = raw.match(/Node "([^"]+)"/);
    const paramMatch = raw.match(/parameters?: ([\w,\s]+)/);
    await supabase
      .from("flows")
      .update({
        status: "NeedsInformation",
        blocking: [
          {
            node_id: null,
            node_label: nodeMatch?.[1] ?? "غير محددة",
            missing: (paramMatch?.[1]?.trim().split(/[,\s]+/) ?? []).map((f) => ({
              field: f,
              label: f,
            })),
          },
        ],
      })
      .eq("id", id);
    return Response.json({
      status: "NeedsInformation",
      node: nodeMatch?.[1] ?? null,
      missing_params: paramMatch?.[1]?.trim() ?? null,
      detail: raw.slice(0, 300),
    });
  }

  // المفعّل يبقى مفعّلًا بعد إعادة البناء: مؤقّته في المحرّك ما زال مسلّحًا،
  // فإنزاله إلى «جاهز للاختبار» يقول للمستخدم إنه توقّف وهو يعمل.
  await supabase
    .from("flows")
    .update({
      n8n_workflow_id: n8nId,
      status: flow.status === "Active" ? "Active" : "ReadyToTest",
      blocking: null,
    })
    .eq("id", id);

  return Response.json({ status: "ReadyToTest", n8n_workflow_id: n8nId, created });
}
