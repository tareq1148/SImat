// Execution Adapter — يحوّل التمثيل الداخلي (Workflow IR) إلى صيغة n8n
// PRD 10.6: الرسم يعكس التنفيذ الحقيقي، وواجهة المحرك تبقى مخفية.

import type { IRNode, Provider, WorkflowIR } from "./types";
import type { N8nWorkflowPayload } from "./n8n";
import { parseSchedule } from "./schedule";

export interface CredentialMap {
  gmail?: { id: string; name: string };
  google_sheets?: { id: string; name: string };
  google_drive?: { id: string; name: string };
  google_slides?: { id: string; name: string };
  google_calendar?: { id: string; name: string };
  google_docs?: { id: string; name: string };
  openai?: { id: string; name: string };
  telegram?: { id: string; name: string };
  slack?: { id: string; name: string };
  instagram?: { id: string; name: string };
  tiktok?: { id: string; name: string };
  // remove.bg خدمة منصّة بمفتاح في البيئة — لا اعتماد لكل مستخدم
  removebg?: { id: string; name: string };
}

interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  onError?: string;
}

type Connections = Record<
  string,
  { main?: Array<Array<{ node: string; type: string; index: number }>>;
    ai_languageModel?: Array<Array<{ node: string; type: string; index: number }>> }
>;

const INPUT_NODE = "تجهيز المدخلات";

/**
 * موضع الحفظ في درايف. كان الجذر مكتوبًا في الكود، فكل ما يُنتجه المسار
 * يهبط في أعلى الدرايف مهما بلغ عدده. صار المستخدم ينتقي مجلّده، والجذر
 * ملاذًا لا حكمًا.
 */
function driveFolderRl(folderId?: string): Record<string, unknown> {
  return folderId
    ? { __rl: true, mode: "id", value: folderId }
    : { __rl: true, mode: "list", value: "root", cachedResultName: "/ (Root folder)" };
}

function hookUrl(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/hooks/run-event`;
}

function secret(): string {
  return process.env.MUHAWWIL_WEBHOOK_SECRET ?? "dev-secret";
}

function reportNode(
  id: string,
  name: string,
  x: number,
  y: number,
  jsonBodyExpr: string
): N8nNode {
  return {
    id,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [x, y],
    parameters: {
      method: "POST",
      url: hookUrl(),
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: "x-muhawwil-secret", value: secret() }],
      },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: jsonBodyExpr,
      options: { timeout: 15000 },
    },
    onError: "continueRegularOutput",
  };
}

function composePromptFor(node: IRNode, contract: string): string {
  return (
    "=أنت خطوة داخل أتمتة. المطلوب: " +
    node.description.replace(/\n/g, " ") +
    (node.params.prompt ? "\nتعليمات إضافية: " + node.params.prompt : "") +
    "\n\nبيانات بدء التشغيل:\n{{ JSON.stringify($('" +
    INPUT_NODE +
    "').item.json.payload) }}\n\nنتيجة الخطوة السابقة:\n{{ JSON.stringify($json) }}\n\n" +
    contract
  );
}

const STRICT_JSON =
  "أخرج JSON صالحًا فقط بدون أي شرح أو أسوار markdown.";

// البرومبت يحقن حمولة التشغيل ونتيجة الخطوة السابقة ليفهم النموذج السياق،
// لا لينشرها. بدون هذا المنع تسرّبت معرّفات المستندات و«بيانات تجريبية»
// إلى شرائح العرض نفسها.
const NO_PLUMBING =
  " اكتب محتوى حقيقيًا عن موضوع المهمة نفسه. " +
  "ممنوع منعًا باتًا أن تذكر معرّفات أو روابط أو أسماء حقول تقنية أو حمولة التشغيل " +
  "أو أنك داخل أتمتة أو أن البيانات تجريبية — القارئ لا يعرف شيئًا عن ذلك ولا يعنيه.";


// هل هذه خطوة إرسال «ملخّص واحد» أم «رسالة لكل عنصر»؟
// n8n ينفّذ كل عقدة مرة لكل عنصر داخل، فخطوة إرسال بعد جلب عشرين إيميلًا
// تُرسل عشرين رسالة. حين تكون النية تلخيصًا نجمع العناصر في عنصر واحد أولًا.
// نبقى محافظين: الافتراضي هو السلوك القديم (رسالة لكل عنصر)، ولا نجمع إلا
// حين يقول الوصف صراحةً إنه ملخّص أو تقرير أو تجميع.
const DIGEST_RE =
  /ملخّ?ص|تلخيص|لخّ?ص|تقرير|مجمّ?ع|تجميع|خلاصة|digest|summar|report|combined|overview/i;

function isDigestSend(irNode: IRNode): boolean {
  return DIGEST_RE.test(`${irNode.label} ${irNode.description}`);
}

export function irToN8n(
  ir: WorkflowIR,
  creds: CredentialMap,
  /** معرّف المسار — يصير رمز التشغيل للانطلاقات المجدولة التي لا طالب لها */
  flowId?: string
): N8nWorkflowPayload {
  const nodes: N8nNode[] = [];
  const connections: Connections = {};
  let x = -600;
  const Y = 300;
  const step = () => {
    x += 260;
    return x;
  };

  const link = (from: string, to: string, outputIndex = 0) => {
    const entry = (connections[from] ??= {});
    const main = (entry.main ??= []);
    while (main.length <= outputIndex) main.push([]);
    main[outputIndex].push({ node: to, type: "main", index: 0 });
  };

  const linkModel = (modelName: string, consumer: string) => {
    connections[modelName] = {
      ai_languageModel: [[{ node: consumer, type: "ai_languageModel", index: 0 }]],
    };
  };

  // 1) المدخل
  const inX = step();
  nodes.push({
    id: "webhook",
    name: "المدخل",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2.1,
    position: [inX, Y],
    parameters: {
      httpMethod: "POST",
      path: ir.webhookPath,
      responseMode: "onReceived",
    },
  });

  // 1‑ب) الموعد — مدخلٌ ثانٍ للمسار المجدول.
  //
  // الـwebhook ينتظر نداءً ولا ينطلق من نفسه، فمسارٌ لا مؤقّت له لا يعمل
  // إلا بضغطة زرّ. ويبقى الـwebhook معه لا بدلًا منه: منه يأتي الاختبار
  // والتشغيل اليدوي، ومن المؤقّت يأتي الموعد. كلاهما يصبّ في تجهيز المدخلات.
  const triggerIR = ir.nodes.find((n) => n.type === "trigger");
  const scheduleText =
    triggerIR?.operation === "schedule"
      ? triggerIR.params?.schedule || triggerIR.label
      : null;
  if (scheduleText) {
    nodes.push({
      id: "schedule",
      name: "الموعد",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [inX, Y + 190],
      parameters: { rule: parseSchedule(scheduleText) },
    });
  }

  // 2) تجهيز المدخلات
  nodes.push({
    id: "inputs",
    name: INPUT_NODE,
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [step(), Y],
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        // المؤقّت لا يرسل body، فتُقرأ الحقول من كائنٍ بديل بدل أن ينكسر
        // التعبير. ورمز التشغيل يقع على المسار نفسه حين لا طالب له —
        // فيعرف المستقبِل لمن يسجّل الانطلاقة المجدولة.
        assignments: [
          {
            id: "a1",
            name: "run_token",
            value: `={{ ($json.body || {}).run_token || '${flowId ? `flow:${flowId}` : ""}' }}`,
            type: "string",
          },
          {
            id: "a2",
            name: "test_mode",
            value: "={{ ($json.body || {}).test_mode === true }}",
            type: "boolean",
          },
          {
            id: "a3",
            name: "payload",
            value: "={{ ($json.body || {}).input || {} }}",
            type: "object",
          },
        ],
      },
    },
  });
  link("المدخل", INPUT_NODE);
  if (scheduleText) link("الموعد", INPUT_NODE);

  // 3) تبليغ بدء التشغيل
  const startedBody =
    '={{ JSON.stringify({ run_token: $(\'' +
    INPUT_NODE +
    "').item.json.run_token, event: 'started', execution_id: $execution.id }) }}";
  nodes.push(reportNode("report-start", "تبليغ البدء", step(), Y - 180, startedBody));
  link(INPUT_NODE, "تبليغ البدء");

  let prev = "تبليغ البدء";
  let modelCount = 0;

  const addOpenAiModel = (consumerName: string, xPos: number): void => {
    modelCount += 1;
    const name = `نموذج OpenAI ${modelCount}`;
    const node: N8nNode = {
      id: `model-${modelCount}`,
      name,
      type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      typeVersion: 1.2,
      position: [xPos, Y + 220],
      parameters: {
        model: { __rl: true, mode: "list", value: "gpt-5-mini" },
        options: {},
      },
    };
    if (creds.openai) node.credentials = { openAiApi: creds.openai };
    nodes.push(node);
    linkModel(name, consumerName);
  };

  const executable = ir.nodes.filter(
    (n) => n.type !== "trigger" && n.type !== "output"
  );

  // سلاسل استخراجٍ منظَّم لا تأليف — تبقى سلسلة بسيطة ولا تتحوّل إلى وكيل
  const structuredLlm = new Set<string>();

  // بوابة الإجراء الحساس: التأليف مشترك، ثم اختبار → معاينة فقط (لا تنفيذ)؛
  // فعلي → طلب موافقة → انتظار → موافقة → تنفيذ. الرفض يُنهي التشغيل.
  // الاختبار صار ينفّذ فعليًا كالتشغيل، فلا قسمةَ وضعٍ ولا معاينة: الإجراء
  // الحسّاس يوصَل بما قبله مباشرةً. أُبقي الوصل في موضع واحد كي لا يتكرّر
  // في فروع المزوّدين الأربعة.
  const attachSensitiveAction = (
    actionNodeName: string,
    fromName: string,
    connectAction: (fromName: string, outputIndex?: number) => void
  ): string => {
    connectAction(fromName, 0);
    return actionNodeName;
  };

  for (const irNode of executable) {
    if (irNode.type === "approval") {
      // عقدة الموافقة في الرسم بصرية — البوابة الفعلية تُبنى حول العقدة الحساسة نفسها
      continue;
    }

    const xPos = step();
    const nodeName = irNode.label;

    const connectPrev = (target: string) => {
      if (prev.startsWith("__merge__:")) {
        const [a, b] = prev.replace("__merge__:", "").split("|");
        link(a, target, 0);
        link(b, target, 0);
      } else {
        link(prev, target);
      }
    };

    if (irNode.provider === "openai" || irNode.type === "openai" || irNode.type === "condition") {
      // خطوة ذكاء اصطناعي أو قاعدة قرار — سلسلة LLM
      const contract =
        irNode.type === "condition"
          ? "طبّق القاعدة التالية على البيانات وأخرج JSON بالمفاتيح {decision, reason, data}: " +
            (irNode.params.rule ?? irNode.description) +
            " — " +
            STRICT_JSON
          : STRICT_JSON + " أخرج النتيجة بمفتاح text داخل JSON: {\"text\": \"...\"}";
      if (isDigestSend(irNode)) {
        const aggName = `تجميع المدخلات: ${nodeName}`;
        nodes.push({
          id: `${irNode.id}-agg`,
          name: aggName,
          type: "n8n-nodes-base.aggregate",
          typeVersion: 1,
          position: [step(), Y],
          parameters: {
            aggregate: "aggregateAllItemData",
            destinationFieldName: "items",
          },
        });
        connectPrev(aggName);
        prev = aggName;
      }

      const llmNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.9,
        position: [xPos, Y],
        parameters: {
          promptType: "define",
          text: composePromptFor(irNode, contract),
          messages: {
            messageValues: [
              {
                message:
                  "أنت محرك تنفيذ دقيق داخل منصة أتمتة. التزم حرفيًا بعقد الإخراج المطلوب.",
              },
            ],
          },
          batching: {},
        },
      };
      nodes.push(llmNode);
      connectPrev(nodeName);
      addOpenAiModel(nodeName, xPos);
      prev = nodeName;
      continue;
    }

    if (irNode.provider === "gmail") {
      // قراءة البريد لا تأليفه: كانت خطوة «اجلب الإيميلات» تُبنى عقدةَ إرسال
      // فيؤلّف النموذج مستلمًا ونصًّا ويُرسل بريدًا بدل أن يقرأ شيئًا.
      if (
        /read|list|fetch|search|get_?mail|جلب|قراءة|اقرأ/i.test(
          `${irNode.operation} ${irNode.label}`
        )
      ) {
        const readMail: N8nNode = {
          id: irNode.id,
          name: nodeName,
          type: "n8n-nodes-base.gmail",
          typeVersion: 2.1,
          position: [xPos, Y],
          parameters: {
            resource: "message",
            operation: "getAll",
            returnAll: false,
            limit: Number(irNode.params.limit ?? 10),
            simple: true,
            filters: {
              q: String(irNode.params.query ?? "newer_than:1d"),
            },
          },
        };
        if (creds.gmail) readMail.credentials = { gmailOAuth2: creds.gmail };
        nodes.push(readMail);
        connectPrev(nodeName);
        prev = nodeName;
        continue;
      }

      // تأليف محتوى الرسالة أولًا ثم الإرسال
      const composeName = `تأليف: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-compose`,
        name: composeName,
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.9,
        position: [xPos, Y],
        parameters: {
          promptType: "define",
          text: composePromptFor(
            irNode,
            'أخرج JSON بالمفاتيح {"to": "البريد", "subject": "الموضوع", "body": "نص الرسالة"}. ' +
              (irNode.params.recipient
                ? `المستلم المحدد مسبقًا: ${irNode.params.recipient}. `
                : "") +
              STRICT_JSON
          ),
          messages: {
            messageValues: [
              { message: "أنت تكتب رسائل بريد مهنية موجزة بالعربية أو بلغة المستلم." },
            ],
          },
          batching: {},
        },
      });
      connectPrev(composeName);
      addOpenAiModel(composeName, xPos);

      const sendName = nodeName;
      const composeRef = `($('${composeName}').item.json.output ?? $('${composeName}').item.json.text)`;
      const gmailNode: N8nNode = {
        id: irNode.id,
        name: sendName,
        type: "n8n-nodes-base.gmail",
        typeVersion: 2.2,
        position: [step(), Y],
        parameters: {
          sendTo:
            irNode.params.recipient && irNode.params.recipient.includes("@")
              ? irNode.params.recipient
              : `={{ JSON.parse(${composeRef}).to }}`,
          subject: `={{ JSON.parse(${composeRef}).subject }}`,
          emailType: "text",
          message: `={{ JSON.parse(${composeRef}).body }}`,
          options: { appendAttribution: false },
        },
      };
      if (creds.gmail) gmailNode.credentials = { gmailOAuth2: creds.gmail };

      // PRD: كل إرسال يمر ببوابة موافقة مهما كان تصنيف المواصفة — لا استثناء
      const mergePoint = attachSensitiveAction(sendName, composeName, (fromName, out = 0) => {
        gmailNode.position = [x + 910, Y + 180];
        nodes.push(gmailNode);
        link(fromName, sendName, out);
      });
      prev = mergePoint;
      continue;
    }

    if (irNode.provider === "telegram" || irNode.provider === "slack") {
      const isTelegram = irNode.provider === "telegram";
      // ملخّص واحد؟ اجمع كل العناصر في عنصر واحد قبل التأليف، وإلا صارت
      // رسالة مستقلة لكل إيميل بدل رسالة واحدة مرتّبة.
      if (isDigestSend(irNode)) {
        const aggName = `تجميع العناصر: ${nodeName}`;
        nodes.push({
          id: `${irNode.id}-agg`,
          name: aggName,
          type: "n8n-nodes-base.aggregate",
          typeVersion: 1,
          position: [step(), Y],
          parameters: { aggregate: "aggregateAllItemData", destinationFieldName: "items" },
        });
        connectPrev(aggName);
        // بلا هذا يبقى التجميع فرعًا ميتًا: الوصل التالي يخرج من العقدة
        // السابقة نفسها فيلتفّ حوله، فيظلّ التأليف يجري مرّة لكل عنصر.
        prev = aggName;
      }

      const composeName = `تأليف: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-compose`,
        name: composeName,
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.9,
        position: [xPos, Y],
        parameters: {
          promptType: "define",
          text: composePromptFor(
            irNode,
            'أخرج JSON بالمفاتيح {"text": "نص الرسالة"}. ' +
              (isDigestSend(irNode)
                ? "المدخل يحوي كل العناصر في الحقل items. اكتب رسالة واحدة مرتّبة:\n" +
                  "- ابدأ بسطر عنوان قصير فيه عدد العناصر.\n" +
                  "- رتّبها بالأهمية: ما يحتاج ردًّا أو إجراءً أولًا، ثم ما هو للعلم، " +
                  "ثم الترويجي والإشعارات الآلية مجموعةً في سطر واحد.\n" +
                  "- كل عنصر سطر واحد يبدأ بـ«• »: الجهة ثم جوهر الرسالة بجملة " +
                  "مفيدة تُغني عن فتحها — لا تنسخ عنوانها كما هو.\n" +
                  "- أهمل التواقيع وروابط إلغاء الاشتراك وسلاسل الردود المكرّرة.\n" +
                  "- إن لم يكن فيها ما يستحق، قلها صراحةً بسطر واحد.\n" +
                  "- نصّ عادي بلا نجوم ولا شرطات markdown ولا رموز HTML. "
                : "") +
            STRICT_JSON
          ),
          messages: {
            messageValues: [
              { message: "أنت تكتب رسائل قصيرة واضحة بالعربية أو بلغة المستلم." },
            ],
          },
          batching: {},
        },
      });
      connectPrev(composeName);
      addOpenAiModel(composeName, xPos);

      const sendName = nodeName;
      const composeRef = `($('${composeName}').item.json.output ?? $('${composeName}').item.json.text)`;
      const msgNode: N8nNode = isTelegram
        ? {
            id: irNode.id,
            name: sendName,
            type: "n8n-nodes-base.telegram",
            typeVersion: 1.2,
            position: [step(), Y],
            parameters: {
              resource: "message",
              operation: "sendMessage",
              chatId:
                irNode.params.chat_id ??
                "={{ $('" + INPUT_NODE + "').item.json.payload.chat_id }}",
              // العقدة تفسّر النصّ MarkdownV2 حيث حتى «.» و«-» رموز خاصة، فأي
              // ملخّص يكتبه نموذج يُرفض بـ«can't parse entities» وتصل صفر رسائل
              // بلا سبب ظاهر. إفراغ parse_mode لا يعطّل التفسير — الحل HTML:
              // رموزه الخاصة ثلاثة فقط، ونادرة في نصّ عربي، ونحذفها من المصدر.
              text: `={{ String(JSON.parse(${composeRef}).text).split("<").join("").split(">").join("").split("&").join("و") }}`,
              additionalFields: { appendAttribution: false, parse_mode: "HTML" },
            },
          }
        : {
            id: irNode.id,
            name: sendName,
            type: "n8n-nodes-base.slack",
            typeVersion: 2.7,
            position: [step(), Y],
            parameters: {
              resource: "message",
              operation: "post",
              select: "channel",
              channelId: {
                __rl: true,
                mode: "name",
                value: irNode.params.slack_channel ?? "general",
              },
              messageType: "text",
              text: `={{ JSON.parse(${composeRef}).text }}`,
              otherOptions: { includeLinkToWorkflow: false },
            },
          };
      if (isTelegram && creds.telegram)
        msgNode.credentials = { telegramApi: creds.telegram };
      if (!isTelegram && creds.slack)
        msgNode.credentials = { slackApi: creds.slack };

      // PRD: كل إرسال يمر ببوابة موافقة مهما كان تصنيف المواصفة — لا استثناء
      const msgMergePoint = attachSensitiveAction(sendName, composeName, (fromName, out = 0) => {
        msgNode.position = [x + 910, Y + 180];
        nodes.push(msgNode);
        link(fromName, sendName, out);
      });
      prev = msgMergePoint;
      continue;
    }

    if (irNode.provider === "instagram") {
      // نشر إنستقرام: تأليف الكابشن → بوابة موافقة إلزامية → إنشاء الحاوية → النشر
      const composeName = `تأليف: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-compose`,
        name: composeName,
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.9,
        position: [xPos, Y],
        parameters: {
          promptType: "define",
          text: composePromptFor(
            irNode,
            'أخرج JSON بالمفاتيح {"caption": "كابشن المنشور مع الهاشتاقات المناسبة"}. ' +
              STRICT_JSON
          ),
          messages: {
            messageValues: [
              {
                message:
                  "أنت صانع محتوى محترف: كابشن جذاب موجز بالعربية مع هاشتاقات مدروسة (5-8).",
              },
            ],
          },
          batching: {},
        },
      });
      connectPrev(composeName);
      addOpenAiModel(composeName, xPos);

      const composeRef = `($('${composeName}').item.json.output ?? $('${composeName}').item.json.text)`;
      const igUser =
        irNode.params.ig_user_id ??
        "={{ $('" + INPUT_NODE + "').item.json.payload.ig_user_id }}";
      const imageUrl =
        irNode.params.image_url ??
        "={{ $('" + INPUT_NODE + "').item.json.payload.image_url }}";

      const containerName = `تجهيز المنشور: ${nodeName}`;
      const containerNode: N8nNode = {
        id: `${irNode.id}-container`,
        name: containerName,
        type: "n8n-nodes-base.facebookGraphApi",
        typeVersion: 1,
        position: [x + 910, Y + 180],
        parameters: {
          hostUrl: "graph.facebook.com",
          httpRequestMethod: "POST",
          graphApiVersion: "v21.0",
          node: igUser,
          edge: "media",
          options: {
            queryParameters: {
              parameter: [
                { name: "image_url", value: imageUrl },
                { name: "caption", value: `={{ JSON.parse(${composeRef}).caption }}` },
              ],
            },
          },
        },
      };
      const publishNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "n8n-nodes-base.facebookGraphApi",
        typeVersion: 1,
        position: [x + 1170, Y + 180],
        parameters: {
          hostUrl: "graph.facebook.com",
          httpRequestMethod: "POST",
          graphApiVersion: "v21.0",
          node: igUser,
          edge: "media_publish",
          options: {
            queryParameters: {
              parameter: [{ name: "creation_id", value: "={{ $json.id }}" }],
            },
          },
        },
      };
      if (creds.instagram) {
        containerNode.credentials = { facebookGraphApi: creds.instagram };
        publishNode.credentials = { facebookGraphApi: creds.instagram };
      }

      const igMerge = attachSensitiveAction(nodeName, composeName, (fromName, out = 0) => {
        nodes.push(containerNode);
        nodes.push(publishNode);
        link(fromName, containerName, out);
        link(containerName, nodeName);
      });
      prev = igMerge;
      continue;
    }

    if (irNode.provider === "tiktok") {
      // تيك توك: تأليف العنوان والوصف → بوابة موافقة → استدعاء Content Posting API (هيكل)
      const composeName = `تأليف: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-compose`,
        name: composeName,
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.9,
        position: [xPos, Y],
        parameters: {
          promptType: "define",
          text: composePromptFor(
            irNode,
            'أخرج JSON بالمفاتيح {"title": "عنوان قصير", "description": "وصف الفيديو مع هاشتاقات"}. ' +
              STRICT_JSON
          ),
          messages: {
            messageValues: [
              { message: "أنت صانع محتوى تيك توك: عناوين خاطفة وأوصاف قصيرة رائجة." },
            ],
          },
          batching: {},
        },
      });
      connectPrev(composeName);
      addOpenAiModel(composeName, xPos);

      const composeRef = `($('${composeName}').item.json.output ?? $('${composeName}').item.json.text)`;
      const videoExpr = irNode.params.video_url
        ? JSON.stringify(irNode.params.video_url)
        : "$('" + INPUT_NODE + "').item.json.payload.video_url";

      const ttNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [x + 910, Y + 180],
        parameters: {
          method: "POST",
          url: "https://open.tiktokapis.com/v2/post/publish/video/init/",
          authentication: "genericCredentialType",
          genericAuthType: "httpHeaderAuth",
          sendBody: true,
          contentType: "json",
          specifyBody: "json",
          jsonBody:
            `={{ JSON.stringify({ post_info: { title: JSON.parse(${composeRef}).title, ` +
            `description: JSON.parse(${composeRef}).description, privacy_level: 'SELF_ONLY' }, ` +
            `source_info: { source: 'PULL_FROM_URL', video_url: ${videoExpr} } }) }}`,
          options: { timeout: 60000 },
        },
      };
      if (creds.tiktok)
        ttNode.credentials = { httpHeaderAuth: creds.tiktok };

      const ttMerge = attachSensitiveAction(nodeName, composeName, (fromName, out = 0) => {
        nodes.push(ttNode);
        link(fromName, nodeName, out);
      });
      prev = ttMerge;
      continue;
    }

    if (irNode.provider === "google_sheets") {
      // القيمة قد تكون رابطًا كتبه المستخدم أو معرّفًا حلّه البحث في Drive
      const sheetRl = (url: unknown, name: unknown) =>
        url
          ? {
              __rl: true,
              mode: String(url).startsWith("http") ? "url" : "id",
              value: url,
            }
          : {
              __rl: true,
              mode: "list",
              value: "",
              cachedResultName: name ?? "اختر الجدول من داخل المنصة",
            };

      // قراءة صفوف: لا تأليف قبلها ولا صفّ يُجهَّز — تُخرج الصفوف كما هي
      if (/read|get|list|fetch|lookup|قراءة|جلب/i.test(`${irNode.operation} ${irNode.label}`)) {
        const readNode: N8nNode = {
          id: irNode.id,
          name: nodeName,
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 4.7,
          position: [xPos, Y],
          parameters: {
            resource: "sheet",
            operation: "read",
            documentId: sheetRl(
              irNode.params.spreadsheet_url,
              irNode.params.spreadsheet_name
            ),
            sheetName: irNode.params.sheet_name
              ? { __rl: true, mode: "name", value: irNode.params.sheet_name }
              : { __rl: true, mode: "id", value: "0", cachedResultName: "الورقة الأولى" },
            options: {},
          },
        };
        if (creds.google_sheets)
          readNode.credentials = { googleSheetsOAuth2Api: creds.google_sheets };
        nodes.push(readNode);
        connectPrev(nodeName);
        prev = nodeName;
        continue;
      }

      const composeName = `تجهيز الصف: ${nodeName}`;
      structuredLlm.add(`${irNode.id}-compose`);
      nodes.push({
        id: `${irNode.id}-compose`,
        name: composeName,
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.9,
        position: [xPos, Y],
        parameters: {
          promptType: "define",
          text: composePromptFor(
            irNode,
            'أخرج JSON مسطحًا (قيم نصية/رقمية فقط) يمثل الصف الذي سيُضاف للجدول، بمفاتيح بأسماء الأعمدة. ' +
              STRICT_JSON
          ),
          messages: { messageValues: [{ message: "أنت تجهز بيانات منظمة لجداول." }] },
          batching: {},
        },
      });
      connectPrev(composeName);
      addOpenAiModel(composeName, xPos);

      const parseName = `صف جاهز: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-parse`,
        name: parseName,
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [step(), Y],
        parameters: {
          mode: "raw",
          jsonOutput:
            "={{ JSON.parse(String($json.output ?? $json.text).replace(/```json/g, '').replace(/```/g, '').trim()) }}",
          options: {},
        },
      });
      link(composeName, parseName);

      const sheetUrl = irNode.params.spreadsheet_url ?? "";
      const sheetsNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "n8n-nodes-base.googleSheets",
        typeVersion: 4.7,
        position: [step(), Y],
        parameters: {
          resource: "sheet",
          operation: "append",
          documentId: sheetUrl
            ? {
                __rl: true,
                mode: String(sheetUrl).startsWith("http") ? "url" : "id",
                value: sheetUrl,
              }
            : {
                __rl: true,
                mode: "list",
                value: "",
                cachedResultName:
                  irNode.params.spreadsheet_name ?? "اختر الجدول من داخل المنصة",
              },
          sheetName: irNode.params.sheet_name
            ? { __rl: true, mode: "name", value: irNode.params.sheet_name }
            : { __rl: true, mode: "id", value: "0", cachedResultName: "الورقة الأولى" },
          columns: { mappingMode: "autoMapInputData", value: {}, schema: [] },
          options: { handlingExtraData: "insertInNewColumn" },
        },
      };
      if (creds.google_sheets)
        sheetsNode.credentials = { googleSheetsOAuth2Api: creds.google_sheets };
      nodes.push(sheetsNode);
      link(parseName, nodeName);
      prev = nodeName;
      continue;
    }

    if (irNode.provider === "google_drive") {
      const act = `${irNode.operation} ${irNode.label}`;

      // تنزيل ملف: كان يُبنى إنشاءَ ملفٍ نصّي فيُخرج معرّفًا فارغًا بدل الصورة
      if (/download|تنزيل|جلب|fetch_file|get_file/i.test(act)) {
        const dl: N8nNode = {
          id: irNode.id,
          name: nodeName,
          type: "n8n-nodes-base.googleDrive",
          typeVersion: 3,
          position: [xPos, Y],
          parameters: {
            resource: "file",
            operation: "download",
            fileId: {
              __rl: true,
              mode: "url",
              // المعرّف من المواصفة، وإلا أوّل رابط في الصفّ الوارد مهما كان اسم عموده
              value:
                irNode.params.file_id ??
                irNode.params.image_url ??
                "={{ $json.id || Object.values($json).find(v => typeof v === 'string' && v.startsWith('http')) }}",
            },
            options: { binaryPropertyName: "data" },
          },
        };
        if (creds.google_drive)
          dl.credentials = { googleDriveOAuth2Api: creds.google_drive };
        nodes.push(dl);
        connectPrev(nodeName);
        prev = nodeName;
        continue;
      }

      // رفع ملفّ جاهز (صورة نتجت عن خطوة سابقة) — لا إنشاء ملفٍ نصّي
      if (/upload|رفع/i.test(act)) {
        const up: N8nNode = {
          id: irNode.id,
          name: nodeName,
          type: "n8n-nodes-base.googleDrive",
          typeVersion: 3,
          position: [xPos, Y],
          parameters: {
            resource: "file",
            operation: "upload",
            inputDataFieldName: "data",
            name:
              irNode.params.file_name ??
              "={{ 'watirah-' + $now.toFormat('yyyy-MM-dd-HHmmss') + '.png' }}",
            driveId: { __rl: true, mode: "list", value: "My Drive" },
            folderId: driveFolderRl(irNode.params.folder_id),
            options: {},
          },
        };
        if (creds.google_drive)
          up.credentials = { googleDriveOAuth2Api: creds.google_drive };
        nodes.push(up);
        connectPrev(nodeName);
        prev = nodeName;
        continue;
      }

      const driveNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "n8n-nodes-base.googleDrive",
        typeVersion: 3,
        position: [xPos, Y],
        parameters: {
          resource: "file",
          operation: "createFromText",
          content:
            "={{ typeof ($json.output ?? $json.text) === 'string' ? ($json.output ?? $json.text) : JSON.stringify($json, null, 2) }}",
          name:
            irNode.params.file_name ??
            "={{ 'muhawwil-' + $now.toFormat('yyyy-MM-dd-HHmm') + '.txt' }}",
          driveId: { __rl: true, mode: "list", value: "My Drive" },
          folderId: driveFolderRl(irNode.params.folder_id),
          options: {},
        },
      };
      if (creds.google_drive)
        driveNode.credentials = { googleDriveOAuth2Api: creds.google_drive };
      nodes.push(driveNode);
      connectPrev(nodeName);
      prev = nodeName;
      continue;
    }

    // مستند جوجل: يُنشأ بعنوانه ثم يُحقن فيه النص المولّد — عمليتان لأن
    // عقدة الإنشاء في n8n لا تقبل محتوًى، والإدراج عملية update مستقلّة.
    if (irNode.provider === "google_docs") {
      const composeName = `تجهيز نص المستند: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-compose`,
        name: composeName,
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.9,
        position: [xPos, Y],
        parameters: {
          promptType: "define",
          text: composePromptFor(
            irNode,
            "أخرج نصّ المستند كاملًا كنصّ عادي بلا عناوين markdown ولا أسوار." +
              NO_PLUMBING
          ),
          messages: { messageValues: [{ message: "أنت تحرّر مستندات عربية واضحة." }] },
          batching: {},
        },
      });
      connectPrev(composeName);
      addOpenAiModel(composeName, xPos);

      const createName = `إنشاء المستند: ${nodeName}`;
      const createNode: N8nNode = {
        id: `${irNode.id}-create`,
        name: createName,
        type: "n8n-nodes-base.googleDocs",
        typeVersion: 2,
        position: [step(), Y],
        parameters: {
          operation: "create",
          title:
            irNode.params.title ??
            "={{ 'وَتيرة - ' + $now.toFormat('yyyy-MM-dd HH:mm') }}",
          folderId: irNode.params.folder_id ?? "default",
        },
      };
      if (creds.google_docs)
        createNode.credentials = { googleDocsOAuth2Api: creds.google_docs };
      nodes.push(createNode);
      link(composeName, createName);

      const insertNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "n8n-nodes-base.googleDocs",
        typeVersion: 2,
        position: [step(), Y],
        parameters: {
          operation: "update",
          // عقدة الإنشاء تُخرج ملفًا بصيغة Drive: المعرّف في id لا في documentId
          documentURL: "={{ $json.id }}",
          actionsUi: {
            actionFields: [
              {
                action: "insert",
                text: `={{ $('${composeName}').item.json.output ?? $('${composeName}').item.json.text }}`,
              },
            ],
          },
        },
      };
      if (creds.google_docs)
        insertNode.credentials = { googleDocsOAuth2Api: creds.google_docs };
      nodes.push(insertNode);
      link(createName, nodeName);
      prev = nodeName;
      continue;
    }

    // عرض تقديمي: عقدة n8n تُنشئ العرض بعنوانه فقط وتتركه بشريحة فارغة.
    // فيُولَّد المحتوى، ثم يُنشأ العرض، ثم تُبنى الشرائح عبر batchUpdate في
    // واجهة Slides مباشرةً — وتُحذف الشريحة الافتراضية الفارغة في آخر الدفعة.
    if (irNode.provider === "google_slides") {
      const composeName = `تجهيز الشرائح: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-compose`,
        name: composeName,
        type: "@n8n/n8n-nodes-langchain.chainLlm",
        typeVersion: 1.9,
        position: [xPos, Y],
        parameters: {
          promptType: "define",
          text: composePromptFor(
            irNode,
            'أخرج JSON بالشكل {"slides":[{"title":"...","body":"..."}]} ' +
              "من أربع إلى ستّ شرائح. الأولى شريحة عنوان: title عنوان العرض " +
              "وbody سطر واحد يصف الموضوع. وكل شريحة بعدها body فيه سطران إلى " +
              "أربعة، كل سطر نقطة قصيرة مستقلّة مفصولة بسطر جديد، بلا شرطات " +
              "ولا ترقيم في أول السطر. " +
              STRICT_JSON +
              NO_PLUMBING
          ),
          messages: {
            messageValues: [{ message: "أنت تعدّ عروضًا تقديمية عربية موجزة." }],
          },
          batching: {},
        },
      });
      connectPrev(composeName);
      addOpenAiModel(composeName, xPos);

      const parseName = `شرائح جاهزة: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-parse`,
        name: parseName,
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [step(), Y],
        parameters: {
          mode: "raw",
          jsonOutput:
            "={{ JSON.parse(String($json.output ?? $json.text).replace(/```json/g, '').replace(/```/g, '').trim()) }}",
          options: {},
        },
      });
      link(composeName, parseName);

      const createName = `إنشاء العرض: ${nodeName}`;
      const createNode: N8nNode = {
        id: `${irNode.id}-create`,
        name: createName,
        type: "n8n-nodes-base.googleSlides",
        typeVersion: 2,
        position: [step(), Y],
        parameters: {
          resource: "presentation",
          operation: "create",
          title:
            irNode.params.title ??
            "={{ 'وَتيرة - ' + $now.toFormat('yyyy-MM-dd HH:mm') }}",
        },
      };
      if (creds.google_slides)
        createNode.credentials = { googleSlidesOAuth2Api: creds.google_slides };
      nodes.push(createNode);
      link(parseName, createName);

      const buildName = `بناء طلبات الشرائح: ${nodeName}`;
      nodes.push({
        id: `${irNode.id}-batch`,
        name: buildName,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [step(), Y],
        parameters: {
          jsCode: [
            `const src = $('${parseName}').first().json;`,
            `const made = $('${createName}').first().json;`,
            "const slides = Array.isArray(src.slides) ? src.slides : [];",
            "const requests = [];",
            "const ACCENT = { red: 0.18, green: 0.49, blue: 0.2 };",
            "slides.forEach((s, i) => {",
            "  const sid = 'wt_slide_' + i, tid = 'wt_title_' + i, bid = 'wt_body_' + i;",
            "  // الأولى شريحة عنوان، والبقيّة عنوان ونقاط",
            "  const cover = i === 0;",
            "  requests.push({ createSlide: { objectId: sid,",
            "    slideLayoutReference: { predefinedLayout: cover ? 'TITLE' : 'TITLE_AND_BODY' },",
            "    placeholderIdMappings: [",
            "      { layoutPlaceholder: { type: cover ? 'CENTERED_TITLE' : 'TITLE', index: 0 }, objectId: tid },",
            "      { layoutPlaceholder: { type: cover ? 'SUBTITLE' : 'BODY', index: 0 }, objectId: bid }",
            "    ] } });",
            "  const title = String(s.title || '').trim();",
            "  // النقاط سطرًا سطرًا، وتُنزع الشرطات إن أضافها النموذج رغم المنع",
            "  const body = String(s.body || '')",
            "    .split(/\\r?\\n/)",
            "    .map((l) => l.replace(/^\\s*[-•*\\d.)]+\\s*/, '').trim())",
            "    .filter(Boolean)",
            "    .join('\\n');",
            "  if (title) requests.push({ insertText: { objectId: tid, text: title } });",
            "  if (body) requests.push({ insertText: { objectId: bid, text: body } });",
            "  if (title) requests.push({ updateTextStyle: { objectId: tid,",
            "    textRange: { type: 'ALL' },",
            "    style: { bold: true, foregroundColor: { opaqueColor: { rgbColor: ACCENT } } },",
            "    fields: 'bold,foregroundColor' } });",
            "  if (body && !cover) requests.push({ createParagraphBullets: { objectId: bid,",
            "    textRange: { type: 'ALL' }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });",
            "});",
            "// الشريحة الافتراضية تُحذف بعد إضافة شرائحنا حتى لا يمرّ العرض فارغًا",
            "const firstId = made.slides && made.slides[0] && made.slides[0].objectId;",
            "if (firstId && requests.length) requests.push({ deleteObject: { objectId: firstId } });",
            "return [{ json: { presentationId: made.presentationId, requests } }];",
          ].join("\n"),
        },
      });
      link(createName, buildName);

      const fillNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [step(), Y],
        parameters: {
          method: "POST",
          url: "=https://slides.googleapis.com/v1/presentations/{{ $json.presentationId }}:batchUpdate",
          authentication: "predefinedCredentialType",
          nodeCredentialType: "googleSlidesOAuth2Api",
          sendBody: true,
          specifyBody: "json",
          jsonBody: "={{ JSON.stringify({ requests: $json.requests }) }}",
          options: {},
        },
      };
      if (creds.google_slides)
        fillNode.credentials = { googleSlidesOAuth2Api: creds.google_slides };
      nodes.push(fillNode);
      link(buildName, nodeName);
      prev = nodeName;
      continue;
    }

    // موعد في التقويم: الأوقات من المواصفة، وإن غابت فمن وقت التشغيل
    if (irNode.provider === "google_calendar") {
      const calendarNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "n8n-nodes-base.googleCalendar",
        typeVersion: 1.3,
        position: [xPos, Y],
        parameters: {
          resource: "event",
          operation: "create",
          calendar: {
            __rl: true,
            mode: "list",
            value: irNode.params.calendar_id ?? "primary",
            cachedResultName: irNode.params.calendar_id ?? "primary",
          },
          start: irNode.params.start ?? "={{ $now.toISO() }}",
          end: irNode.params.end ?? "={{ $now.plus(60 * 60 * 1000).toISO() }}",
          additionalFields: {
            summary: irNode.params.summary ?? irNode.label,
            ...(irNode.params.description
              ? { description: irNode.params.description }
              : {}),
            ...(irNode.params.attendees
              ? { attendees: irNode.params.attendees }
              : {}),
          },
        },
      };
      if (creds.google_calendar)
        calendarNode.credentials = {
          googleCalendarOAuth2Api: creds.google_calendar,
        };
      nodes.push(calendarNode);
      connectPrev(nodeName);
      prev = nodeName;
      continue;
    }

    // remove.bg: لا عقدة لها في n8n، فتُنادى واجهتها مباشرةً. المفتاح من بيئة
    // المنصّة — المستخدم لا يربط شيئًا ولا يرى المفتاح. الخرج ملفّ ثنائي،
    // فتقدر عقدة Drive بعدها أن ترفعه كما هو.
    if (irNode.provider === "removebg") {
      // إن سبقها تنزيل من Drive فالصورة بين يديها ملفًّا ثنائيًا — تُرسل كما هي.
      // وإلا فرابطها في الصفّ الوارد، وأعمدة المستخدم بأسماء لا نعرفها
      // («Image link» مثلًا)، فنلتقط أوّل قيمة نصّية تبدأ بـhttp.
      const at = executable.indexOf(irNode);
      const before = at > 0 ? executable[at - 1] : null;
      const binaryUpstream =
        !!before &&
        before.provider === "google_drive" &&
        /download|تنزيل|جلب|fetch_file|get_file/i.test(
          `${before.operation} ${before.label}`
        );
      const rawImageRef = irNode.params.image_url
        ? JSON.stringify(String(irNode.params.image_url))
        : "Object.values($json).find(v => typeof v === 'string' && v.startsWith('http'))";
      // روابط درايف التي ينسخها المستخدم روابط عرضٍ لا تنزيل: من يجلبها
      // يستقبل صفحة HTML لا صورة، فيردّ remove.bg «Is the given file an
      // image?». نحوّلها إلى صيغة التنزيل المباشر، وما ليس درايف يمرّ كما هو.
      const imageRef =
        "(u => { const s = String(u || ''); if (!/drive\\.google\\.com|docs\\.google\\.com/.test(s)) return s;" +
        " const m = s.match(/\\/d\\/([-\\w]{10,})/) || s.match(/[?&]id=([-\\w]{10,})/);" +
        " return m ? 'https://drive.google.com/uc?export=download&id=' + m[1] : s; })(" +
        rawImageRef +
        ")";
      // الجدول يُقرأ كاملًا، وفيه صفوفٌ بلا صورة (فارغة أو لم تُملأ بعد).
      // remove.bg يُنادى مرّة لكل صفّ، فيردّ على الفارغ «زوّدني بالمصدر»
      // ويسقط التنفيذ كلّه. نُسقط ما لا صورة فيه قبل أن يصل إليه.
      if (!binaryUpstream) {
        const filterName = "صفوف فيها صورة";
        nodes.push({
          id: `${irNode.id}-filter`,
          name: filterName,
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [step(), Y],
          parameters: {
            jsCode: [
              "// يُبقي الصفوف التي فيها رابطٌ صالح، ويُسقط سواها بلا خطأ",
              "return $input.all().filter((i) =>",
              "  Object.values(i.json).some(",
              "    (v) => typeof v === 'string' && /^https?:\\/\\//.test(v.trim())",
              "  )",
              ");",
            ].join("\n"),
          },
        });
        connectPrev(filterName);
        prev = filterName;
      }

      const rbNode: N8nNode = {
        id: irNode.id,
        name: nodeName,
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [xPos, Y],
        parameters: {
          method: "POST",
          url: "https://api.remove.bg/v1.0/removebg",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "X-Api-Key", value: process.env.REMOVEBG_API_KEY ?? "" },
            ],
          },
          sendBody: true,
          ...(binaryUpstream
            ? {
                contentType: "multipart-form-data",
                bodyParameters: {
                  parameters: [
                    {
                      parameterType: "formBinaryData",
                      name: "image_file",
                      inputDataFieldName: "data",
                    },
                    { name: "size", value: String(irNode.params.size ?? "auto") },
                  ],
                },
              }
            : {
                specifyBody: "json",
                jsonBody:
                  "={{ JSON.stringify({ image_url: " +
                  imageRef +
                  ", size: " +
                  JSON.stringify(String(irNode.params.size ?? "auto")) +
                  " }) }}",
              }),
          options: {
            response: {
              response: { responseFormat: "file", outputPropertyName: "data" },
            },
          },
        },
      };
      nodes.push(rbNode);
      connectPrev(nodeName);
      prev = nodeName;
      continue;
    }

    // احتياط: خطوة غير مصنفة → Set توثيقي
    nodes.push({
      id: irNode.id,
      name: nodeName,
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [xPos, Y],
      parameters: {
        mode: "manual",
        includeOtherFields: true,
        assignments: {
          assignments: [
            { id: "s1", name: "step", value: irNode.description, type: "string" },
          ],
        },
      },
    });
    connectPrev(nodeName);
    prev = nodeName;
  }

  // تبليغ الانتهاء
  const finishBody =
    '={{ JSON.stringify({ run_token: $(\'' +
    INPUT_NODE +
    // معرّف التنفيذ يلزم المجدول وحده: رمزه واحدٌ لكل انطلاقاته فلا يميّز
    // واحدةً من أخرى، والمطابقة عنده بالتنفيذ لا بالرمز
    "').item.json.run_token, event: 'finished', status: 'success', execution_id: $execution.id, output: $json }) }}";
  const finishNode = reportNode("report-finish", "تبليغ الانتهاء", step(), Y, finishBody);
  nodes.push(finishNode);
  if (prev.startsWith("__merge__:")) {
    const [a, b] = prev.replace("__merge__:", "").split("|");
    link(a, "تبليغ الانتهاء", 0);
    link(b, "تبليغ الانتهاء", 0);
  } else {
    link(prev, "تبليغ الانتهاء");
  }

  // المواعيد تُقرأ بتوقيت الرياض: «٨ صباحًا» عند المستخدم لا عند خادم المحرّك
  const settings: N8nWorkflowPayload["settings"] = {
    executionOrder: "v1",
    timezone: "Asia/Riyadh",
  };
  if (process.env.N8N_ERROR_WORKFLOW_ID) {
    // أي فشل تنفيذ يُبلَّغ للمنصة عبر معالج الأخطاء العام (PRD 10.7)
    settings.errorWorkflow = process.env.N8N_ERROR_WORKFLOW_ID;
  }

  // الخطوات التي فيها تأليف — مستند، عرض، رسالة، منشور، نصّ مولّد — تُنفَّذ
  // بوكيل ذكاء لا بسلسلة استدعاء واحدة. موضع واحد يحوّلها جميعًا بعد بنائها،
  // فلا تتكرّر المعرفة في كل فرع. الوكيل يُخرج في output لا في text.
  nodes.forEach((n) => {
    if (n.type !== "@n8n/n8n-nodes-langchain.chainLlm") return;
    if (structuredLlm.has(n.id)) return;
    const p = n.parameters as {
      text?: unknown;
      messages?: { messageValues?: Array<{ message?: string }> };
    };
    const system = p.messages?.messageValues?.[0]?.message;
    n.type = "@n8n/n8n-nodes-langchain.agent";
    n.typeVersion = 2;
    n.parameters = {
      promptType: "define",
      text: p.text,
      options: system ? { systemMessage: system } : {},
    };
  });

  return {
    name: `[وَتيرة] ${ir.name}`,
    nodes,
    connections: connections as Record<string, unknown>,
    settings,
  };
}

export function missingProviders(
  ir: WorkflowIR,
  creds: CredentialMap
): Provider[] {
  const needed = new Set<Provider>();
  ir.nodes.forEach((n) => {
    if (n.provider) needed.add(n.provider);
  });
  // كل سلسلة LLM مولّدة تحتاج OpenAI
  if (
    ir.nodes.some(
      (n) =>
        n.type === "openai" ||
        n.type === "condition" ||
        n.provider === "gmail" ||
        n.provider === "google_sheets" ||
        n.provider === "google_docs" ||
        n.provider === "google_slides" ||
        n.provider === "telegram" ||
        n.provider === "slack" ||
        n.provider === "instagram" ||
        n.provider === "tiktok"
    )
  ) {
    needed.add("openai");
  }
  // remove.bg مفتاحها في بيئة المنصّة لا في حساب المستخدم — لا تُطلب منه
  needed.delete("removebg");
  return [...needed].filter((p) => !creds[p]);
}
