// Execution Adapter — يحوّل التمثيل الداخلي (Workflow IR) إلى صيغة n8n
// PRD 10.6: الرسم يعكس التنفيذ الحقيقي، وواجهة المحرك تبقى مخفية.

import type { IRNode, Provider, WorkflowIR } from "./types";
import type { N8nWorkflowPayload } from "./n8n";

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

export function irToN8n(
  ir: WorkflowIR,
  creds: CredentialMap
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
  nodes.push({
    id: "webhook",
    name: "المدخل",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2.1,
    position: [step(), Y],
    parameters: {
      httpMethod: "POST",
      path: ir.webhookPath,
      responseMode: "onReceived",
    },
  });

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
        assignments: [
          {
            id: "a1",
            name: "run_token",
            value: "={{ $json.body.run_token }}",
            type: "string",
          },
          {
            id: "a2",
            name: "test_mode",
            value: "={{ $json.body.test_mode === true }}",
            type: "boolean",
          },
          {
            id: "a3",
            name: "payload",
            value: "={{ $json.body.input || {} }}",
            type: "object",
          },
        ],
      },
    },
  });
  link("المدخل", INPUT_NODE);

  // 3) تبليغ بدء التشغيل
  const startedBody =
    '={{ JSON.stringify({ run_token: $(\'' +
    INPUT_NODE +
    "').item.json.run_token, event: 'started', execution_id: $execution.id }) }}";
  nodes.push(reportNode("report-start", "تبليغ البدء", step(), Y - 180, startedBody));
  link(INPUT_NODE, "تبليغ البدء");

  let prev = "تبليغ البدء";
  let modelCount = 0;
  let approvalCount = 0;

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

  // بوابة الإجراء الحساس: التأليف مشترك، ثم اختبار → معاينة فقط (لا تنفيذ)؛
  // فعلي → طلب موافقة → انتظار → موافقة → تنفيذ. الرفض يُنهي التشغيل.
  const buildSensitiveGate = (
    irNode: IRNode,
    actionNodeName: string,
    connectAction: (fromName: string) => void
  ): string => {
    approvalCount += 1;
    const n = approvalCount;
    const gateIf = `وضع الاختبار؟ ${n}`;
    nodes.push({
      id: `gate-if-${n}`,
      name: gateIf,
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [step(), Y],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
          conditions: [
            {
              id: `c-gate-${n}`,
              leftValue: "={{ $('" + INPUT_NODE + "').item.json.test_mode }}",
              rightValue: "",
              operator: { type: "boolean", operation: "true", singleValue: true },
            },
          ],
          combinator: "and",
        },
      },
    });

    const previewName = `معاينة بدون تنفيذ ${n}`;
    nodes.push({
      id: `preview-${n}`,
      name: previewName,
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [x + 130, Y - 180],
      parameters: {
        mode: "manual",
        includeOtherFields: true,
        assignments: {
          assignments: [
            {
              id: "p1",
              name: "approval_preview",
              value:
                "وضع الاختبار: الإجراء الحساس «" +
                irNode.label +
                "» لم يُنفَّذ فعليًا — أعلاه معاينة لما كان سيحدث.",
              type: "string",
            },
            { id: "p2", name: "skipped_sensitive", value: "={{ true }}", type: "boolean" },
          ],
        },
      },
    });

    const askName = `طلب الموافقة ${n}`;
    const askBody =
      '={{ JSON.stringify({ run_token: $(\'' +
      INPUT_NODE +
      "').item.json.run_token, event: 'approval_requested', summary: " +
      JSON.stringify(irNode.description) +
      ", gated_step: " +
      JSON.stringify(irNode.label) +
      ", resume_url: $execution.resumeUrl, data: $json }) }}";
    nodes.push(reportNode(`ask-${n}`, askName, x + 130, Y + 180, askBody));

    const waitName = `انتظار قرارك ${n}`;
    nodes.push({
      id: `wait-${n}`,
      name: waitName,
      type: "n8n-nodes-base.wait",
      typeVersion: 1.1,
      position: [x + 390, Y + 180],
      parameters: { resume: "webhook", httpMethod: "POST", options: {} },
    });

    const approvedIf = `تمت الموافقة؟ ${n}`;
    nodes.push({
      id: `approved-if-${n}`,
      name: approvedIf,
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [x + 650, Y + 180],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
          conditions: [
            {
              id: `c-appr-${n}`,
              leftValue: "={{ $json.body.approved }}",
              rightValue: "",
              operator: { type: "boolean", operation: "true", singleValue: true },
            },
          ],
          combinator: "and",
        },
      },
    });

    const rejectedName = `تبليغ الرفض ${n}`;
    const rejectedBody =
      '={{ JSON.stringify({ run_token: $(\'' +
      INPUT_NODE +
      "').item.json.run_token, event: 'finished', status: 'rejected', output: { message: 'رفض المستخدم تنفيذ الإجراء الحساس — أُوقف التشغيل.' } }) }}";
    nodes.push(
      reportNode(`rejected-${n}`, rejectedName, x + 910, Y + 350, rejectedBody)
    );

    link(gateIf, previewName, 0);
    link(gateIf, askName, 1);
    link(askName, waitName);
    link(waitName, approvedIf);
    link(approvedIf, rejectedName, 1);
    // فرع الموافقة → عقدة التنفيذ الفعلية
    connectAction(approvedIf);

    // نقطة الالتقاء: المعاينة (اختبار) أو نتيجة التنفيذ الفعلي
    return `__merge__:${previewName}|${actionNodeName}`;
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
      const composeRef = `$('${composeName}').item.json.text`;
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
      const mergePoint = buildSensitiveGate(irNode, sendName, (fromName) => {
        gmailNode.position = [x + 910, Y + 180];
        nodes.push(gmailNode);
        link(fromName, sendName, 0);
      });
      link(composeName, `وضع الاختبار؟ ${approvalCount}`);
      prev = mergePoint;
      continue;
    }

    if (irNode.provider === "telegram" || irNode.provider === "slack") {
      const isTelegram = irNode.provider === "telegram";
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
            'أخرج JSON بالمفاتيح {"text": "نص الرسالة"}. ' + STRICT_JSON
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
      const composeRef = `$('${composeName}').item.json.text`;
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
              text: `={{ JSON.parse(${composeRef}).text }}`,
              additionalFields: { appendAttribution: false },
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
      const msgMergePoint = buildSensitiveGate(irNode, sendName, (fromName) => {
        msgNode.position = [x + 910, Y + 180];
        nodes.push(msgNode);
        link(fromName, sendName, 0);
      });
      link(composeName, `وضع الاختبار؟ ${approvalCount}`);
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

      const composeRef = `$('${composeName}').item.json.text`;
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

      const igMerge = buildSensitiveGate(irNode, nodeName, (fromName) => {
        nodes.push(containerNode);
        nodes.push(publishNode);
        link(fromName, containerName, 0);
        link(containerName, nodeName);
      });
      link(composeName, `وضع الاختبار؟ ${approvalCount}`);
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

      const composeRef = `$('${composeName}').item.json.text`;
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

      const ttMerge = buildSensitiveGate(irNode, nodeName, (fromName) => {
        nodes.push(ttNode);
        link(fromName, nodeName, 0);
      });
      link(composeName, `وضع الاختبار؟ ${approvalCount}`);
      prev = ttMerge;
      continue;
    }

    if (irNode.provider === "google_sheets") {
      const composeName = `تجهيز الصف: ${nodeName}`;
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
          jsonOutput: "={{ JSON.parse($json.text) }}",
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
            ? { __rl: true, mode: "url", value: sheetUrl }
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
            "={{ typeof $json.text === 'string' ? $json.text : JSON.stringify($json, null, 2) }}",
          name:
            irNode.params.file_name ??
            "={{ 'muhawwil-' + $now.toFormat('yyyy-MM-dd-HHmm') + '.txt' }}",
          driveId: { __rl: true, mode: "list", value: "My Drive" },
          folderId: {
            __rl: true,
            mode: "list",
            value: "root",
            cachedResultName: "/ (Root folder)",
          },
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
    "').item.json.run_token, event: 'finished', status: 'success', output: $json }) }}";
  const finishNode = reportNode("report-finish", "تبليغ الانتهاء", step(), Y, finishBody);
  nodes.push(finishNode);
  if (prev.startsWith("__merge__:")) {
    const [a, b] = prev.replace("__merge__:", "").split("|");
    link(a, "تبليغ الانتهاء", 0);
    link(b, "تبليغ الانتهاء", 0);
  } else {
    link(prev, "تبليغ الانتهاء");
  }

  const settings: N8nWorkflowPayload["settings"] = { executionOrder: "v1" };
  if (process.env.N8N_ERROR_WORKFLOW_ID) {
    // أي فشل تنفيذ يُبلَّغ للمنصة عبر معالج الأخطاء العام (PRD 10.7)
    settings.errorWorkflow = process.env.N8N_ERROR_WORKFLOW_ID;
  }

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
        n.provider === "telegram" ||
        n.provider === "slack" ||
        n.provider === "instagram" ||
        n.provider === "tiktok"
    )
  ) {
    needed.add("openai");
  }
  return [...needed].filter((p) => !creds[p]);
}
